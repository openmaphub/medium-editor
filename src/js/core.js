
var Util = require('./util');
var Selection = require('./selection');
var Extensions = require('./extensions');
var Defaults = require('./defaults');
    // Event handlers that shouldn't be exposed externally



    class MediumEditor {
        // NOT DOCUMENTED - exposed for backwards compatability
        constructor(elements, options) {
            this.options = MediumEditor.mergeOptions(Defaults.Options, options);
            this.origElements = elements;

            if (!this.options.elementsContainer) {
                this.options.elementsContainer = this.options.ownerDocument.body;
            }

            return this.setup();
        }

        setup() {
            if (this.isActive) {
                return;
            }

            this.createElementsArray.call(this, this.origElements);

            if (this.elements.length === 0) {
                return;
            }

            this.isActive = true;
            this.addToEditors.call(this, this.options.contentWindow);

            this.events = new MediumEditor.Events(this);

            // Call initialization helpers
            this.initElements.call(this);
            this.initExtensions.call(this);
            this.attachHandlers.call(this);

        }


        destroy() {
            if (!this.isActive) {
                return;
            }

            this.isActive = false;

            this.extensions.forEach(function (extension) {
                if (typeof extension.destroy === 'function') {
                    extension.destroy();
                }
            }, this);

            this.events.destroy();

            this.elements.forEach(function (element) {
                // Reset elements content, fix for issue where after editor destroyed the red underlines on spelling errors are left
                if (this.options.spellcheck) {
                    element.innerHTML = element.innerHTML;
                }

                // cleanup extra added attributes
                element.removeAttribute('contentEditable');
                element.removeAttribute('spellcheck');
                element.removeAttribute('data-medium-editor-element');
                element.removeAttribute('role');
                element.removeAttribute('aria-multiline');
                element.removeAttribute('medium-editor-index');

                // Remove any elements created for textareas
                if (element.hasAttribute('medium-editor-textarea-id')) {
                    var textarea = element.parentNode.querySelector('textarea[medium-editor-textarea-id="' + element.getAttribute('medium-editor-textarea-id') + '"]');
                    if (textarea) {
                        // Un-hide the textarea
                        textarea.classList.remove('medium-editor-hidden');
                    }
                    if (element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                }
            }, this);
            this.elements = [];

            this.removeFromEditors.call(this, this.options.contentWindow);
        }

        on(target, event, listener, useCapture) {
            this.events.attachDOMEvent(target, event, listener, useCapture);
        }

        off(target, event, listener, useCapture) {
            this.events.detachDOMEvent(target, event, listener, useCapture);
        }

        subscribe(event, listener) {
            this.events.attachCustomEvent(event, listener);
        }

        unsubscribe(event, listener) {
            this.events.detachCustomEvent(event, listener);
        }

        trigger(name, data, editable) {
            this.events.triggerCustomEvent(name, data, editable);
        }

        delay(fn) {
            var self = this;
            return setTimeout(function () {
                if (self.isActive) {
                    fn();
                }
            }, this.options.delay);
        }

        serialize() {
            var i,
                elementid,
                content = {};
            for (i = 0; i < this.elements.length; i += 1) {
                elementid = (this.elements[i].id !== '') ? this.elements[i].id : 'element-' + i;
                content[elementid] = {
                    value: this.elements[i].innerHTML.trim()
                };
            }
            return content;
        }

        getExtensionByName(name) {
            var extension;
            if (this.extensions && this.extensions.length) {
                this.extensions.some(function (ext) {
                    if (ext.name === name) {
                        extension = ext;
                        return true;
                    }
                    return false;
                });
            }
            return extension;
        }

        /**
         * NOT DOCUMENTED - exposed as a helper for other extensions to use
         */
        addBuiltInExtension(name, opts) {
            var extension = this.getExtensionByName(name),
                mergedOpts;
            if (extension) {
                return extension;
            }

            switch (name) {
                case 'anchor':
                    mergedOpts = Util.extend({}, this.getExtenionDefaults(), this.options.anchor, opts);
                    extension = new Extensions.Anchor(mergedOpts);
                    break;
                case 'anchor-preview':
                    mergedOpts = Util.extend({}, this.getExtenionDefaults(), this.options.anchorPreview);
                    extension = new Extensions.AnchorPreview(mergedOpts);
                    break;
                case 'autoLink':
                    extension = new Extensions.AutoLink(this.getExtenionDefaults());
                    break;
                case 'fileDragging':
                    mergedOpts = Util.extend({}, this.getExtenionDefaults(), opts);
                    extension = new Extensions.FileDragging(mergedOpts);
                    break;
                case 'fontsize':
                    mergedOpts = Util.extend({}, this.getExtenionDefaults(), opts);
                    extension = new Extensions.FontSize(mergedOpts);
                    break;
                case 'keyboardCommands':
                    mergedOpts = Util.extend({}, this.getExtenionDefaults(), this.options.keyboardCommands);
                    extension = new Extensions.KeyboardCommands(mergedOpts);
                    break;
                case 'paste':
                    mergedOpts = Util.extend({}, this.getExtenionDefaults(), this.options.paste);
                    extension = new Extensions.Paste(mergedOpts);
                    break;
                case 'placeholder':
                    mergedOpts = Util.extend({}, this.getExtenionDefaults(), this.options.placeholder);
                    extension = new Extensions.Placeholder(mergedOpts);
                    break;
                default:
                    // All of the built-in buttons for MediumEditor are extensions
                    // so check to see if the extension we're creating is a built-in button
                    if (Extensions.Button.isBuiltInButton(name)) {
                        if (opts) {
                            mergedOpts = Util.defaults({}, this.getExtenionDefaults(), opts, MediumEditor.extensions.button.prototype.defaults[name]);
                            extension = new Extensions.Button(mergedOpts);
                        } else {
                            mergedOpts = Util.defaults({}, this.getExtenionDefaults(), {name});
                            extension = new Extensions.Button(mergedOpts);
                        }
                    }
            }

            if (extension) {
                this.extensions.push(extension);
            }

            return extension;
        }

        stopSelectionUpdates() {
            this.preventSelectionUpdates = true;
        }

        startSelectionUpdates() {
            this.preventSelectionUpdates = false;
        }

        checkSelection() {
            var toolbar = this.getExtensionByName('toolbar');
            if (toolbar) {
                toolbar.checkState();
            }
            return this;
        }

        // Wrapper around document.queryCommandState for checking whether an action has already
        // been applied to the current selection
        queryCommandState(action) {
            var fullAction = /^full-(.+)$/gi,
                match,
                queryState = null;

            // Actions starting with 'full-' need to be modified since this is a medium-editor concept
            match = fullAction.exec(action);
            if (match) {
                action = match[1];
            }

            try {
                queryState = this.options.ownerDocument.queryCommandState(action);
            } catch (exc) {
                queryState = null;
            }

            return queryState;
        }

        execAction(action, opts) {
            /*jslint regexp: true*/
            var fullAction = /^full-(.+)$/gi,
                match,
                result;
            /*jslint regexp: false*/

            // Actions starting with 'full-' should be applied to to the entire contents of the editable element
            // (ie full-bold, full-append-pre, etc.)
            match = fullAction.exec(action);
            if (match) {
                // Store the current selection to be restored after applying the action
                this.saveSelection();
                // Select all of the contents before calling the action
                this.selectAllContents();
                result = this.execActionInternal.call(this, match[1], opts);
                // Restore the previous selection
                this.restoreSelection();
            } else {
                result = this.execActionInternal.call(this, action, opts);
            }

            // do some DOM clean-up for known browser issues after the action
            if (action === 'insertunorderedlist' || action === 'insertorderedlist') {
                Util.cleanListDOM(this.options.ownerDocument, this.getSelectedParentElement());
            }

            this.checkSelection();
            return result;
        }

        getSelectedParentElement(range) {
            if (range === undefined) {
                range = this.options.contentWindow.getSelection().getRangeAt(0);
            }
            return Selection.getSelectedParentElement(range);
        }

        selectAllContents() {
            var currNode = Selection.getSelectionElement(this.options.contentWindow);

            if (currNode) {
                // Move to the lowest descendant node that still selects all of the contents
                while (currNode.children.length === 1) {
                    currNode = currNode.children[0];
                }

                this.selectElement(currNode);
            }
        }

        selectElement(element) {
            Selection.selectNode(element, this.options.ownerDocument);

            var selElement = Selection.getSelectionElement(this.options.contentWindow);
            if (selElement) {
                this.events.focusElement(selElement);
            }
        }

        getFocusedElement() {
            var focused;
            this.elements.some(function (element) {
                // Find the element that has focus
                if (!focused && element.getAttribute('data-medium-focused')) {
                    focused = element;
                }

                // bail if we found the element that had focus
                return !!focused;
            }, this);

            return focused;
        }

        // Export the state of the selection in respect to one of this
        // instance of MediumEditor's elements
        exportSelection() {
            var selectionElement = Selection.getSelectionElement(this.options.contentWindow),
                editableElementIndex = this.elements.indexOf(selectionElement),
                selectionState = null;

            if (editableElementIndex >= 0) {
                selectionState = Selection.exportSelection(selectionElement, this.options.ownerDocument);
            }

            if (selectionState !== null && editableElementIndex !== 0) {
                selectionState.editableElementIndex = editableElementIndex;
            }

            return selectionState;
        }

        saveSelection() {
            this.selectionState = this.exportSelection();
        }

        // Restore a selection based on a selectionState returned by a call
        // to MediumEditor.exportSelection
        importSelection(selectionState, favorLaterSelectionAnchor) {
            if (!selectionState) {
                return;
            }

            var editableElement = this.elements[selectionState.editableElementIndex || 0];
            Selection.importSelection(selectionState, editableElement, this.options.ownerDocument, favorLaterSelectionAnchor);
        }

        restoreSelection() {
            this.importSelection(this.selectionState);
        }

        createLink(opts) {
            var currentEditor = Selection.getSelectionElement(this.options.contentWindow),
                customEvent = {};

            // Make sure the selection is within an element this editor is tracking
            if (this.elements.indexOf(currentEditor) === -1) {
                return;
            }

            try {
                this.events.disableCustomEvent('editableInput');
                if (opts.url && opts.url.trim().length > 0) {
                    var currentSelection = this.options.contentWindow.getSelection();
                    if (currentSelection) {
                        var currRange = currentSelection.getRangeAt(0),
                            commonAncestorContainer = currRange.commonAncestorContainer,
                            exportedSelection,
                            startContainerParentElement,
                            endContainerParentElement,
                            textNodes;

                        // If the selection is contained within a single text node
                        // and the selection starts at the beginning of the text node,
                        // MSIE still says the startContainer is the parent of the text node.
                        // If the selection is contained within a single text node, we
                        // want to just use the default browser 'createLink', so we need
                        // to account for this case and adjust the commonAncestorContainer accordingly
                        if (currRange.endContainer.nodeType === 3 &&
                            currRange.startContainer.nodeType !== 3 &&
                            currRange.startOffset === 0 &&
                            currRange.startContainer.firstChild === currRange.endContainer) {
                            commonAncestorContainer = currRange.endContainer;
                        }

                        startContainerParentElement = Util.getClosestBlockContainer(currRange.startContainer);
                        endContainerParentElement = Util.getClosestBlockContainer(currRange.endContainer);

                        // If the selection is not contained within a single text node
                        // but the selection is contained within the same block element
                        // we want to make sure we create a single link, and not multiple links
                        // which can happen with the built in browser functionality
                        if (commonAncestorContainer.nodeType !== 3 && startContainerParentElement === endContainerParentElement) {
                            var parentElement = (startContainerParentElement || currentEditor),
                                fragment = this.options.ownerDocument.createDocumentFragment();

                            // since we are going to create a link from an extracted text,
                            // be sure that if we are updating a link, we won't let an empty link behind (see #754)
                            // (Workaroung for Chrome)
                            this.execAction('unlink');

                            exportedSelection = this.exportSelection();
                            fragment.appendChild(parentElement.cloneNode(true));

                            if (currentEditor === parentElement) {
                                // We have to avoid the editor itself being wiped out when it's the only block element,
                                // as our reference inside this.elements gets detached from the page when insertHTML runs.
                                // If we just use [parentElement, 0] and [parentElement, parentElement.childNodes.length]
                                // as the range boundaries, this happens whenever parentElement === currentEditor.
                                // The tradeoff to this workaround is that a orphaned tag can sometimes be left behind at
                                // the end of the editor's content.
                                // In Gecko:
                                // as an empty <strong></strong> if parentElement.lastChild is a <strong> tag.
                                // In WebKit:
                                // an invented <br /> tag at the end in the same situation
                                Selection.select(
                                    this.options.ownerDocument,
                                    parentElement.firstChild,
                                    0,
                                    parentElement.lastChild,
                                    parentElement.lastChild.nodeType === 3 ?
                                    parentElement.lastChild.nodeValue.length : parentElement.lastChild.childNodes.length
                                );
                            } else {
                                Selection.select(
                                    this.options.ownerDocument,
                                    parentElement,
                                    0,
                                    parentElement,
                                    parentElement.childNodes.length
                                );
                            }

                            var modifiedExportedSelection = this.exportSelection();

                            textNodes = Util.findOrCreateMatchingTextNodes(
                                this.options.ownerDocument,
                                fragment,
                                {
                                    start: exportedSelection.start - modifiedExportedSelection.start,
                                    end: exportedSelection.end - modifiedExportedSelection.start,
                                    editableElementIndex: exportedSelection.editableElementIndex
                                }
                            );

                            // Creates the link in the document fragment
                            Util.createLink(this.options.ownerDocument, textNodes, opts.url.trim());

                            // Chrome trims the leading whitespaces when inserting HTML, which messes up restoring the selection.
                            var leadingWhitespacesCount = (fragment.firstChild.innerHTML.match(/^\s+/) || [''])[0].length;

                            // Now move the created link back into the original document in a way to preserve undo/redo history
                            Util.insertHTMLCommand(this.options.ownerDocument, fragment.firstChild.innerHTML.replace(/^\s+/, ''));
                            exportedSelection.start -= leadingWhitespacesCount;
                            exportedSelection.end -= leadingWhitespacesCount;

                            this.importSelection(exportedSelection);
                        } else {
                            this.options.ownerDocument.execCommand('createLink', false, opts.url);
                        }

                        if (this.options.targetBlank || opts.target === '_blank') {
                            Util.setTargetBlank(Selection.getSelectionStart(this.options.ownerDocument), opts.url);
                        }

                        if (opts.buttonClass) {
                            Util.addClassToAnchors(Selection.getSelectionStart(this.options.ownerDocument), opts.buttonClass);
                        }
                    }
                }
                // Fire input event for backwards compatibility if anyone was listening directly to the DOM input event
                if (this.options.targetBlank || opts.target === '_blank' || opts.buttonClass) {
                    customEvent = this.options.ownerDocument.createEvent('HTMLEvents');
                    customEvent.initEvent('input', true, true, this.options.contentWindow);
                    for (var i = 0; i < this.elements.length; i += 1) {
                        this.elements[i].dispatchEvent(customEvent);
                    }
                }
            } finally {
                this.events.enableCustomEvent('editableInput');
            }
            // Fire our custom editableInput event
            this.events.triggerCustomEvent('editableInput', customEvent, currentEditor);
        }

        cleanPaste(text) {
            this.getExtensionByName('paste').cleanPaste(text);
        }

        pasteHTML(html, options) {
            this.getExtensionByName('paste').pasteHTML(html, options);
        }

        setContent(html, index) {
            index = index || 0;

            if (this.elements[index]) {
                var target = this.elements[index];
                target.innerHTML = html;
                this.events.updateInput(target, {target, currentTarget: target});
            }
        }

        handleDisabledEnterKeydown(event, element) {
            if (this.options.disableReturn || element.getAttribute('data-disable-return')) {
                event.preventDefault();
            } else if (this.options.disableDoubleReturn || element.getAttribute('data-disable-double-return')) {
                var node = Selection.getSelectionStart(this.options.ownerDocument);

                // if current text selection is empty OR previous sibling text is empty
                if ((node && node.textContent.trim() === '') ||
                    (node.previousElementSibling && node.previousElementSibling.textContent.trim() === '')) {
                    event.preventDefault();
                }
            }
        }

        handleTabKeydown(event) {
            // Override tab only for pre nodes
            var node = Selection.getSelectionStart(this.options.ownerDocument),
                tag = node && node.nodeName.toLowerCase();

            if (tag === 'pre') {
                event.preventDefault();
                Util.insertHTMLCommand(this.options.ownerDocument, '    ');
            }

            // Tab to indent list structures!
            if (Util.isListItem(node)) {
                event.preventDefault();

                // If Shift is down, outdent, otherwise indent
                if (event.shiftKey) {
                    this.options.ownerDocument.execCommand('outdent', false, null);
                } else {
                    this.options.ownerDocument.execCommand('indent', false, null);
                }
            }
        }

        handleBlockDeleteKeydowns(event) {
            var p, node = Selection.getSelectionStart(this.options.ownerDocument),
                tagName = node.nodeName.toLowerCase(),
                isEmpty = /^(\s+|<br\/?>)?$/i,
                isHeader = /h\d/i;

            if (Util.isKey(event, [Util.keyCode().BACKSPACE, Util.keyCode().ENTER]) &&
                    // has a preceeding sibling
                    node.previousElementSibling &&
                    // in a header
                    isHeader.test(tagName) &&
                    // at the very end of the block
                    Selection.getCaretOffsets(node).left === 0) {
                if (Util.isKey(event, Util.keyCode().BACKSPACE) && isEmpty.test(node.previousElementSibling.innerHTML)) {
                    // backspacing the begining of a header into an empty previous element will
                    // change the tagName of the current node to prevent one
                    // instead delete previous node and cancel the event.
                    node.previousElementSibling.parentNode.removeChild(node.previousElementSibling);
                    event.preventDefault();
                } else if (Util.isKey(event, Util.keyCode().ENTER)) {
                    // hitting return in the begining of a header will create empty header elements before the current one
                    // instead, make "<p><br></p>" element, which are what happens if you hit return in an empty paragraph
                    p = this.options.ownerDocument.createElement('p');
                    p.innerHTML = '<br>';
                    node.previousElementSibling.parentNode.insertBefore(p, node);
                    event.preventDefault();
                }
            } else if (Util.isKey(event, Util.keyCode().DELETE) &&
                        // between two sibling elements
                        node.nextElementSibling &&
                        node.previousElementSibling &&
                        // not in a header
                        !isHeader.test(tagName) &&
                        // in an empty tag
                        isEmpty.test(node.innerHTML) &&
                        // when the next tag *is* a header
                        isHeader.test(node.nextElementSibling.nodeName.toLowerCase())) {
                // hitting delete in an empty element preceding a header, ex:
                //  <p>[CURSOR]</p><h1>Header</h1>
                // Will cause the h1 to become a paragraph.
                // Instead, delete the paragraph node and move the cursor to the begining of the h1

                // remove node and move cursor to start of header
                Selection.moveCursor(this.options.ownerDocument, node.nextElementSibling);

                node.previousElementSibling.parentNode.removeChild(node);

                event.preventDefault();
            } else if (Util.isKey(event, Util.keyCode().BACKSPACE) &&
                    tagName === 'li' &&
                    // hitting backspace inside an empty li
                    isEmpty.test(node.innerHTML) &&
                    // is first element (no preceeding siblings)
                    !node.previousElementSibling &&
                    // parent also does not have a sibling
                    !node.parentElement.previousElementSibling &&
                    // is not the only li in a list
                    node.nextElementSibling &&
                    node.nextElementSibling.nodeName.toLowerCase() === 'li') {
                // backspacing in an empty first list element in the first list (with more elements) ex:
                //  <ul><li>[CURSOR]</li><li>List Item 2</li></ul>
                // will remove the first <li> but add some extra element before (varies based on browser)
                // Instead, this will:
                // 1) remove the list element
                // 2) create a paragraph before the list
                // 3) move the cursor into the paragraph

                // create a paragraph before the list
                p = this.options.ownerDocument.createElement('p');
                p.innerHTML = '<br>';
                node.parentElement.parentElement.insertBefore(p, node.parentElement);

                // move the cursor into the new paragraph
                Selection.moveCursor(this.options.ownerDocument, p);

                // remove the list element
                node.parentElement.removeChild(node);

                event.preventDefault();
            }
        }

        handleKeyup(event) {
            var node = Selection.getSelectionStart(this.options.ownerDocument),
                tagName;

            if (!node) {
                return;
            }

            if (Util.isMediumEditorElement(node) && node.children.length === 0) {
                this.options.ownerDocument.execCommand('formatBlock', false, 'p');
            }

            if (Util.isKey(event, Util.keyCode().ENTER) && !Util.isListItem(node)) {
                tagName = node.nodeName.toLowerCase();
                // For anchor tags, unlink
                if (tagName === 'a') {
                    this.options.ownerDocument.execCommand('unlink', false, null);
                } else if (!event.shiftKey && !event.ctrlKey) {
                    // only format block if this is not a header tag
                    if (!/h\d/.test(tagName)) {
                        this.options.ownerDocument.execCommand('formatBlock', false, 'p');
                    }
                }
            }
        }

        // Internal helper methods which shouldn't be exposed externally

        addToEditors(win) {
            if (!win._mediumEditors) {
                // To avoid breaking users who are assuming that the unique id on
                // medium-editor elements will start at 1, inserting a 'null' in the
                // array so the unique-id can always map to the index of the editor instance
                win._mediumEditors = [null];
            }

            // If this already has a unique id, re-use it
            if (!this.id) {
                this.id = win._mediumEditors.length;
            }

            win._mediumEditors[this.id] = this;
        }

        removeFromEditors(win) {
            if (!win._mediumEditors || !win._mediumEditors[this.id]) {
                return;
            }

            /* Setting the instance to null in the array instead of deleting it allows:
             * 1) Each instance to preserve its own unique-id, even after being destroyed
             *    and initialized again
             * 2) The unique-id to always correspond to an index in the array of medium-editor
             *    instances. Thus, we will be able to look at a contenteditable, and determine
             *    which instance it belongs to, by indexing into the global array.
             */
            win._mediumEditors[this.id] = null;
        }

        createElementsArray(selector) {
            if (!selector) {
                selector = [];
            }
            // If string, use as query selector
            if (typeof selector === 'string') {
                selector = this.options.ownerDocument.querySelectorAll(selector);
            }
            // If element, put into array
            if (Util.isElement(selector)) {
                selector = [selector];
            }
            // Convert NodeList (or other array like object) into an array
            var elements = Array.prototype.slice.apply(selector);

            // Loop through elements and convert textarea's into divs
            this.elements = [];
            elements.forEach(function (element, index) {
                if (element.nodeName.toLowerCase() === 'textarea') {
                    this.elements.push(this.createContentEditable.call(this, element, index));
                } else {
                    this.elements.push(element);
                }
            }, this);
        }
/*
        setExtensionDefaults(extension, defaults) {
            Object.keys(defaults).forEach(function (prop) {
                if (extension[prop] === undefined) {
                    extension[prop] = defaults[prop];
                }
            });
            return extension;
        }
*/
        getExtenionDefaults(){
          return {
              'window': this.options.contentWindow,
              'document': this.options.ownerDocument,
              'base': this
          }
        }

/*
        initExtension(extension, name, instance) {
            var extensionDefaults = {
                'window': instance.options.contentWindow,
                'document': instance.options.ownerDocument,
                'base': instance
            };

            // Add default options into the extension
            extension = this.setExtensionDefaults(extension, extensionDefaults);

            // Call init on the extension
            if (typeof extension.init === 'function') {
                extension.init();
            }

            // Set extension name (if not already set)
            if (!extension.name) {
                extension.name = name;
            }
            return extension;
        }
*/
        isToolbarEnabled() {
            // If any of the elements don't have the toolbar disabled
            // We need a toolbar
            if (this.elements.every(function (element) {
                    return !!element.getAttribute('data-disable-toolbar');
                })) {
                return false;
            }

            return this.options.toolbar !== false;
        }

        isAnchorPreviewEnabled() {
            // If toolbar is disabled, don't add
            if (!this.isToolbarEnabled.call(this)) {
                return false;
            }

            return this.options.anchorPreview !== false;
        }

        isPlaceholderEnabled() {
            return this.options.placeholder !== false;
        }

        isAutoLinkEnabled() {
            return this.options.autoLink !== false;
        }

        isImageDraggingEnabled() {
            return this.options.imageDragging !== false;
        }

        isKeyboardCommandsEnabled() {
            return this.options.keyboardCommands !== false;
        }

        shouldUseFileDraggingExtension() {
            // Since the file-dragging extension replaces the image-dragging extension,
            // we need to check if the user passed an overrided image-dragging extension.
            // If they have, to avoid breaking users, we won't use file-dragging extension.
            return !this.options.extensions['imageDragging'];
        }

        createContentEditable(textarea, id) {
            var div = this.options.ownerDocument.createElement('div'),
                now = Date.now(),
                uniqueId = 'medium-editor-' + now + '-' + id,
                atts = textarea.attributes;

            // Some browsers can move pretty fast, since we're using a timestamp
            // to make a unique-id, ensure that the id is actually unique on the page
            while (this.options.ownerDocument.getElementById(uniqueId)) {
                now++;
                uniqueId = 'medium-editor-' + now + '-' + id;
            }

            div.className = textarea.className;
            div.id = uniqueId;
            div.innerHTML = textarea.value;

            textarea.setAttribute('medium-editor-textarea-id', uniqueId);

            // re-create all attributes from the textearea to the new created div
            for (var i = 0, n = atts.length; i < n; i++) {
                // do not re-create existing attributes
                if (!div.hasAttribute(atts[i].nodeName)) {
                    div.setAttribute(atts[i].nodeName, atts[i].nodeValue);
                }
            }

            textarea.classList.add('medium-editor-hidden');
            textarea.parentNode.insertBefore(
                div,
                textarea
            );

            return div;
        }

        initElements() {
            this.elements.forEach(function (element, index) {
                if (!this.options.disableEditing && !element.getAttribute('data-disable-editing')) {
                    element.setAttribute('contentEditable', true);
                    element.setAttribute('spellcheck', this.options.spellcheck);
                }
                element.setAttribute('data-medium-editor-element', true);
                element.setAttribute('role', 'textbox');
                element.setAttribute('aria-multiline', true);
                element.setAttribute('medium-editor-index', index);

                if (element.hasAttribute('medium-editor-textarea-id')) {
                    this.on(element, 'input', function (event) {
                        var target = event.target,
                            textarea = target.parentNode.querySelector('textarea[medium-editor-textarea-id="' + target.getAttribute('medium-editor-textarea-id') + '"]');
                        if (textarea) {
                            textarea.value = this.serialize()[target.id].value;
                        }
                    }.bind(this));
                }
            }, this);
        }

        attachHandlers() {
            var i;

            // attach to tabs
            this.subscribe('editableKeydownTab', this.handleTabKeydown.bind(this));

            // Bind keys which can create or destroy a block element: backspace, delete, return
            this.subscribe('editableKeydownDelete', this.handleBlockDeleteKeydowns.bind(this));
            this.subscribe('editableKeydownEnter', this.handleBlockDeleteKeydowns.bind(this));

            // disabling return or double return
            if (this.options.disableReturn || this.options.disableDoubleReturn) {
                this.subscribe('editableKeydownEnter', this.handleDisabledEnterKeydown.bind(this));
            } else {
                for (i = 0; i < this.elements.length; i += 1) {
                    if (this.elements[i].getAttribute('data-disable-return') || this.elements[i].getAttribute('data-disable-double-return')) {
                        this.subscribe('editableKeydownEnter', this.handleDisabledEnterKeydown.bind(this));
                        break;
                    }
                }
            }

            // if we're not disabling return, add a handler to help handle cleanup
            // for certain cases when enter is pressed
            if (!this.options.disableReturn) {
                this.elements.forEach(function (element) {
                    if (!element.getAttribute('data-disable-return')) {
                        this.on(element, 'keyup', this.handleKeyup.bind(this));
                    }
                }, this);
            }
        }

        initExtensions() {

            this.extensions = [];

            // Passed in extensions
            Object.keys(this.options.extensions).forEach(function (name) {
                // Always save the toolbar extension for last
                if (name !== 'toolbar' && this.options.extensions[name]) {
                    this.extensions.push(this.initExtension(this.options.extensions[name], name, this));
                }
            }, this);

            // 4 Cases for imageDragging + fileDragging extensons:
            //
            // 1. ImageDragging ON + No Custom Image Dragging Extension:
            //    * Use fileDragging extension (default options)
            // 2. ImageDragging OFF + No Custom Image Dragging Extension:
            //    * Use fileDragging extension w/ images turned off
            // 3. ImageDragging ON + Custom Image Dragging Extension:
            //    * Don't use fileDragging (could interfere with custom image dragging extension)
            // 4. ImageDragging OFF + Custom Image Dragging:
            //    * Don't use fileDragging (could interfere with custom image dragging extension)
            if (this.shouldUseFileDraggingExtension.call(this)) {
                var opts = this.options.fileDragging;
                if (!opts) {
                    opts = {};

                    // Image is in the 'allowedTypes' list by default.
                    // If imageDragging is off override the 'allowedTypes' list with an empty one
                    if (!this.isImageDraggingEnabled.call(this)) {
                        opts.allowedTypes = [];
                    }
                }
                this.addBuiltInExtension('fileDragging', opts);
            }

            // Built-in extensions
            var builtIns = {
                paste: true,
                'anchor-preview': this.isAnchorPreviewEnabled.call(this),
                autoLink: this.isAutoLinkEnabled.call(this),
                keyboardCommands: this.isKeyboardCommandsEnabled.call(this),
                placeholder: this.isPlaceholderEnabled.call(this)
            };
            Object.keys(builtIns).forEach(function (name) {
                if (builtIns[name]) {
                    this.addBuiltInExtension(name);
                }
            }, this);

            // Users can pass in a custom toolbar extension
            // so check for that first and if it's not present
            // just create the default toolbar
            var toolbarExtension = this.options.extensions['toolbar'];
            if (!toolbarExtension && this.isToolbarEnabled.call(this)) {
                // Backwards compatability
                var toolbarOptions = Util.extend({}, this.getExtenionDefaults(), this.options.toolbar, {
                    allowMultiParagraphSelection: this.options.allowMultiParagraphSelection // deprecated
                });
                toolbarExtension = new Extensions.Toolbar(toolbarOptions);
            }

            // If the toolbar is not disabled, so we actually have an extension
            // initialize it and add it to the extensions array
            if (toolbarExtension) {
                this.extensions.push(toolbarExtension);
            }
        }

        static mergeOptions(defaults, options) {
            var deprecatedProperties = [
                ['allowMultiParagraphSelection', 'toolbar.allowMultiParagraphSelection']
            ];
            // warn about using deprecated properties
            if (options) {
                deprecatedProperties.forEach(function (pair) {
                    if (options.hasOwnProperty(pair[0]) && options[pair[0]] !== undefined) {
                        Util.deprecated(pair[0], pair[1], 'v6.0.0');
                    }
                });
            }

            return Util.defaults({}, options, defaults);
        }

        execActionInternal(action, opts) {
            /*jslint regexp: true*/
            var appendAction = /^append-(.+)$/gi,
                justifyAction = /justify([A-Za-z]*)$/g, /* Detecting if is justifyCenter|Right|Left */
                match;
            /*jslint regexp: false*/

            // Actions starting with 'append-' should attempt to format a block of text ('formatBlock') using a specific
            // type of block element (ie append-blockquote, append-h1, append-pre, etc.)
            match = appendAction.exec(action);
            if (match) {
                return Util.execFormatBlock(this.options.ownerDocument, match[1]);
            }

            if (action === 'fontSize') {
                return this.options.ownerDocument.execCommand('fontSize', false, opts.size);
            }

            if (action === 'createLink') {
                return this.createLink(opts);
            }

            if (action === 'image') {
                return this.options.ownerDocument.execCommand('insertImage', false, this.options.contentWindow.getSelection());
            }

            /* Issue: https://github.com/yabwe/medium-editor/issues/595
             * If the action is to justify the text */
            if (justifyAction.exec(action)) {
                var result = this.options.ownerDocument.execCommand(action, false, null),
                    parentNode = Selection.getSelectedParentElement(Selection.getSelectionRange(this.options.ownerDocument));
                if (parentNode) {
                    this.cleanupJustifyDivFragments.call(this, Util.getTopBlockContainer(parentNode));
                }

                return result;
            }

            return this.options.ownerDocument.execCommand(action, false, null);
        }

        /* If we've just justified text within a container block
         * Chrome may have removed <br> elements and instead wrapped lines in <div> elements
         * with a text-align property.  If so, we want to fix this
         */
        cleanupJustifyDivFragments(blockContainer) {
            if (!blockContainer) {
                return;
            }

            var textAlign,
                childDivs = Array.prototype.slice.call(blockContainer.childNodes).filter(function (element) {
                    var isDiv = element.nodeName.toLowerCase() === 'div';
                    if (isDiv && !textAlign) {
                        textAlign = element.style.textAlign;
                    }
                    return isDiv;
                });

            /* If we found child <div> elements with text-align style attributes
             * we should fix this by:
             *
             * 1) Unwrapping each <div> which has a text-align style
             * 2) Insert a <br> element after each set of 'unwrapped' div children
             * 3) Set the text-align style of the parent block element
             */
            if (childDivs.length) {
                // Since we're mucking with the HTML, preserve selection
                this.saveSelection();
                childDivs.forEach(function (div) {
                    if (div.style.textAlign === textAlign) {
                        var lastChild = div.lastChild;
                        if (lastChild) {
                            // Instead of a div, extract the child elements and add a <br>
                            Util.unwrap(div, this.options.ownerDocument);
                            var br = this.options.ownerDocument.createElement('BR');
                            lastChild.parentNode.insertBefore(br, lastChild.nextSibling);
                        }
                    }
                }, this);
                blockContainer.style.textAlign = textAlign;
                // We're done, so restore selection
                this.restoreSelection();
            }
        }
    }
    module.exports = MediumEditor;
