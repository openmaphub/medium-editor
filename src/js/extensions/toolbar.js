var Extension = require('../extension');
var Util = require('../util');
var Selection = require('../selection');
    class Toolbar extends Extension {


      constructor(opts) {
          super(opts);

          this.name = opts.name ? opts.name : 'toolbar';

          /* Toolbar Options */

          /* align: ['left'|'center'|'right']
           * When the __static__ option is true, this aligns the static toolbar
           * relative to the medium-editor element.
           */
          this.align = opts.align ? opts.align : 'center';

          /* allowMultiParagraphSelection: [boolean]
           * enables/disables whether the toolbar should be displayed when
           * selecting multiple paragraphs/block elements
           */
          this.allowMultiParagraphSelection = opts.allowMultiParagraphSelection ? opts.allowMultiParagraphSelection : true;

          /* buttons: [Array]
           * the names of the set of buttons to display on the toolbar.
           */
          this.buttons =  opts.buttons ? opts.buttons : ['bold', 'italic', 'underline', 'anchor', 'h2', 'h3', 'quote'];

          /* diffLeft: [Number]
           * value in pixels to be added to the X axis positioning of the toolbar.
           */
          this.diffLeft = opts.diffLeft ? opts.diffLeft : 0;

          /* diffTop: [Number]
           * value in pixels to be added to the Y axis positioning of the toolbar.
           */
          this.diffTop = opts.diffTop ? opts.diffTop : -10;

          /* firstButtonClass: [string]
           * CSS class added to the first button in the toolbar.
           */
          this.firstButtonClass = opts.firstButtonClass ? opts.firstButtonClass : 'medium-editor-button-first';

          /* lastButtonClass: [string]
           * CSS class added to the last button in the toolbar.
           */
          this.lastButtonClass = opts.lastButtonClass ? opts.lastButtonClass : 'medium-editor-button-last';

          /* standardizeSelectionStart: [boolean]
           * enables/disables standardizing how the beginning of a range is decided
           * between browsers whenever the selected text is analyzed for updating toolbar buttons status.
           */
          this.standardizeSelectionStart = opts.standardizeSelectionStart ? opts.standardizeSelectionStart : false;

          /* static: [boolean]
           * enable/disable the toolbar always displaying in the same location
           * relative to the medium-editor element.
           */
          this.static = opts.static ? opts.static : false;

          /* sticky: [boolean]
           * When the __static__ option is true, this enables/disables the toolbar
           * "sticking" to the viewport and staying visible on the screen while
           * the page scrolls.
           */
          this.sticky = opts.sticky ? opts.sticky : false;

          /* updateOnEmptySelection: [boolean]
           * When the __static__ option is true, this enables/disables updating
           * the state of the toolbar buttons even when the selection is collapsed
           * (there is no selection, just a cursor).
           */
          this.updateOnEmptySelection = opts.updateOnEmptySelection ? opts.updateOnEmptySelection : false;

          /* relativeContainer: [node]
           * appending the toolbar to a given node instead of body
           */
          this.relativeContainer = opts.relativeContainer ? opts.relativeContainer : null;



            this.initThrottledMethods();

            if (!this.relativeContainer) {
                this.getEditorOption('elementsContainer').appendChild(this.getToolbarElement());
            } else {
                this.relativeContainer.appendChild(this.getToolbarElement());
            }
        }

        // Helper method to execute method for every extension, but ignoring the toolbar extension
        forEachExtension(iterator, context) {
            return this.base.extensions.forEach(function (command) {
                if (command === this) {
                    return;
                }
                return iterator.apply(context || this, arguments);
            }, this);
        }

        // Toolbar creation/deletion

        createToolbar() {
            var toolbar = this.document.createElement('div');

            toolbar.id = 'medium-editor-toolbar-' + this.getEditorId();
            toolbar.className = 'medium-editor-toolbar';

            if (this.static) {
                toolbar.className += ' static-toolbar';
            } else if (this.relativeContainer) {
                toolbar.className += ' medium-editor-relative-toolbar';
            } else {
                toolbar.className += ' medium-editor-stalker-toolbar';
            }

            toolbar.appendChild(this.createToolbarButtons());

            // Add any forms that extensions may have
            this.forEachExtension(function (extension) {
                if (extension.hasForm) {
                    toolbar.appendChild(extension.getForm());
                }
            });

            this.attachEventHandlers();

            return toolbar;
        }

        createToolbarButtons() {
            var ul = this.document.createElement('ul'),
                li,
                btn,
                buttons,
                extension,
                buttonName,
                buttonOpts;

            ul.id = 'medium-editor-toolbar-actions' + this.getEditorId();
            ul.className = 'medium-editor-toolbar-actions';
            ul.style.display = 'block';

            this.buttons.forEach(function (button) {
                if (typeof button === 'string') {
                    buttonName = button;
                    buttonOpts = null;
                } else {
                    buttonName = button.name;
                    buttonOpts = button;
                }

                // If the button already exists as an extension, it'll be returned
                // othwerise it'll create the default built-in button
                extension = this.base.addBuiltInExtension(buttonName, buttonOpts);

                if (extension && typeof extension.getButton === 'function') {
                    btn = extension.getButton(this.base);
                    li = this.document.createElement('li');
                    if (Util.isElement(btn)) {
                        li.appendChild(btn);
                    } else {
                        li.innerHTML = btn;
                    }
                    ul.appendChild(li);
                }
            }, this);

            buttons = ul.querySelectorAll('button');
            if (buttons.length > 0) {
                buttons[0].classList.add(this.firstButtonClass);
                buttons[buttons.length - 1].classList.add(this.lastButtonClass);
            }

            return ul;
        }

        destroy() {
            if (this.toolbar) {
                if (this.toolbar.parentNode) {
                    this.toolbar.parentNode.removeChild(this.toolbar);
                }
                delete this.toolbar;
            }
        }

        // Toolbar accessors

        getToolbarElement() {
            if (!this.toolbar) {
                this.toolbar = this.createToolbar();
            }

            return this.toolbar;
        }

        getToolbarActionsElement() {
            return this.getToolbarElement().querySelector('.medium-editor-toolbar-actions');
        }

        // Toolbar event handlers

        initThrottledMethods() {
            // throttledPositionToolbar is throttled because:
            // - It will be called when the browser is resizing, which can fire many times very quickly
            // - For some event (like resize) a slight lag in UI responsiveness is OK and provides performance benefits
            this.throttledPositionToolbar = Util.throttle(function () {
                if (this.base.isActive) {
                    this.positionToolbarIfShown();
                }
            }.bind(this));
        }

        attachEventHandlers() {
            // MediumEditor custom events for when user beings and ends interaction with a contenteditable and its elements
            this.subscribe('blur', this.handleBlur.bind(this));
            this.subscribe('focus', this.handleFocus.bind(this));

            // Updating the state of the toolbar as things change
            this.subscribe('editableClick', this.handleEditableClick.bind(this));
            this.subscribe('editableKeyup', this.handleEditableKeyup.bind(this));

            // Handle mouseup on document for updating the selection in the toolbar
            this.on(this.document.documentElement, 'mouseup', this.handleDocumentMouseup.bind(this));

            // Add a scroll event for sticky toolbar
            if (this.static && this.sticky) {
                // On scroll (capture), re-position the toolbar
                this.on(this.window, 'scroll', this.handleWindowScroll.bind(this), true);
            }

            // On resize, re-position the toolbar
            this.on(this.window, 'resize', this.handleWindowResize.bind(this));
        }

        handleWindowScroll() {
            this.positionToolbarIfShown();
        }

        handleWindowResize() {
            this.throttledPositionToolbar();
        }

        handleDocumentMouseup(event) {
            // Do not trigger checkState when mouseup fires over the toolbar
            if (event &&
                    event.target &&
                    Util.isDescendant(this.getToolbarElement(), event.target)) {
                return false;
            }
            this.checkState();
        }

        handleEditableClick() {
            // Delay the call to checkState to handle bug where selection is empty
            // immediately after clicking inside a pre-existing selection
            setTimeout(function () {
                this.checkState();
            }.bind(this), 0);
        }

        handleEditableKeyup() {
            this.checkState();
        }

        handleBlur() {
            // Kill any previously delayed calls to hide the toolbar
            clearTimeout(this.hideTimeout);

            // Blur may fire even if we have a selection, so we want to prevent any delayed showToolbar
            // calls from happening in this specific case
            clearTimeout(this.delayShowTimeout);

            // Delay the call to hideToolbar to handle bug with multiple editors on the page at once
            this.hideTimeout = setTimeout(function () {
                this.hideToolbar();
            }.bind(this), 1);
        }

        handleFocus() {
            this.checkState();
        }

        // Hiding/showing toolbar

        isDisplayed() {
            return this.getToolbarElement().classList.contains('medium-editor-toolbar-active');
        }

        showToolbar() {
            clearTimeout(this.hideTimeout);
            if (!this.isDisplayed()) {
                this.getToolbarElement().classList.add('medium-editor-toolbar-active');
                this.trigger('showToolbar', {}, this.base.getFocusedElement());
            }
        }

        hideToolbar() {
            if (this.isDisplayed()) {
                this.getToolbarElement().classList.remove('medium-editor-toolbar-active');
                this.trigger('hideToolbar', {}, this.base.getFocusedElement());
            }
        }

        isToolbarDefaultActionsDisplayed() {
            return this.getToolbarActionsElement().style.display === 'block';
        }

        hideToolbarDefaultActions() {
            if (this.isToolbarDefaultActionsDisplayed()) {
                this.getToolbarActionsElement().style.display = 'none';
            }
        }

        showToolbarDefaultActions() {
            this.hideExtensionForms();

            if (!this.isToolbarDefaultActionsDisplayed()) {
                this.getToolbarActionsElement().style.display = 'block';
            }

            // Using setTimeout + options.delay because:
            // We will actually be displaying the toolbar, which should be controlled by options.delay
            this.delayShowTimeout = this.base.delay(function () {
                this.showToolbar();
            }.bind(this));
        }

        hideExtensionForms() {
            // Hide all extension forms
            this.forEachExtension(function (extension) {
                if (extension.hasForm && extension.isDisplayed()) {
                    extension.hideForm();
                }
            });
        }

        // Responding to changes in user selection

        // Checks for existance of multiple block elements in the current selection
        multipleBlockElementsSelected() {
            var regexEmptyHTMLTags = /<[^\/>][^>]*><\/[^>]+>/gim, // http://stackoverflow.com/questions/3129738/remove-empty-tags-using-regex
                regexBlockElements = new RegExp('<(' + Util.blockContainerElementNames.join('|') + ')[^>]*>', 'g'),
                selectionHTML = Selection.getSelectionHtml(this.document).replace(regexEmptyHTMLTags, ''), // Filter out empty blocks from selection
                hasMultiParagraphs = selectionHTML.match(regexBlockElements); // Find how many block elements are within the html

            return !!hasMultiParagraphs && hasMultiParagraphs.length > 1;
        }

        modifySelection() {
            var selection = this.window.getSelection(),
                selectionRange = selection.getRangeAt(0);

            /*
            * In firefox, there are cases (ie doubleclick of a word) where the selectionRange start
            * will be at the very end of an element.  In other browsers, the selectionRange start
            * would instead be at the very beginning of an element that actually has content.
            * example:
            *   <span>foo</span><span>bar</span>
            *
            * If the text 'bar' is selected, most browsers will have the selectionRange start at the beginning
            * of the 'bar' span.  However, there are cases where firefox will have the selectionRange start
            * at the end of the 'foo' span.  The contenteditable behavior will be ok, but if there are any
            * properties on the 'bar' span, they won't be reflected accurately in the toolbar
            * (ie 'Bold' button wouldn't be active)
            *
            * So, for cases where the selectionRange start is at the end of an element/node, find the next
            * adjacent text node that actually has content in it, and move the selectionRange start there.
            */
            if (this.standardizeSelectionStart &&
                    selectionRange.startContainer.nodeValue &&
                    (selectionRange.startOffset === selectionRange.startContainer.nodeValue.length)) {
                var adjacentNode = Util.findAdjacentTextNodeWithContent(Selection.getSelectionElement(this.window), selectionRange.startContainer, this.document);
                if (adjacentNode) {
                    var offset = 0;
                    while (adjacentNode.nodeValue.substr(offset, 1).trim().length === 0) {
                        offset = offset + 1;
                    }
                    selectionRange = Selection.select(this.document, adjacentNode, offset,
                        selectionRange.endContainer, selectionRange.endOffset);
                }
            }
        }

        checkState() {
            if (this.base.preventSelectionUpdates) {
                return;
            }

            // If no editable has focus OR selection is inside contenteditable = false
            // hide toolbar
            if (!this.base.getFocusedElement() ||
                    Selection.selectionInContentEditableFalse(this.window)) {
                return this.hideToolbar();
            }

            // If there's no selection element, selection element doesn't belong to this editor
            // or toolbar is disabled for this selection element
            // hide toolbar
            var selectionElement = Selection.getSelectionElement(this.window);
            if (!selectionElement ||
                    this.getEditorElements().indexOf(selectionElement) === -1 ||
                    selectionElement.getAttribute('data-disable-toolbar')) {
                return this.hideToolbar();
            }

            // Now we know there's a focused editable with a selection

            // If the updateOnEmptySelection option is true, show the toolbar
            if (this.updateOnEmptySelection && this.static) {
                return this.showAndUpdateToolbar();
            }

            // If we don't have a 'valid' selection -> hide toolbar
            if (this.window.getSelection().toString().trim() === '' ||
                (this.allowMultiParagraphSelection === false && this.multipleBlockElementsSelected())) {
                return this.hideToolbar();
            }

            this.showAndUpdateToolbar();
        }

        // Updating the toolbar

        showAndUpdateToolbar() {
            this.modifySelection();
            this.setToolbarButtonStates();
            this.trigger('positionToolbar', {}, this.base.getFocusedElement());
            this.showToolbarDefaultActions();
            this.setToolbarPosition();
        }

        setToolbarButtonStates() {
            this.forEachExtension(function (extension) {
                if (typeof extension.isActive === 'function' &&
                    typeof extension.setInactive === 'function') {
                    extension.setInactive();
                }
            });

            this.checkActiveButtons();
        }

        checkActiveButtons() {
            var manualStateChecks = [],
                queryState = null,
                selectionRange = Selection.getSelectionRange(this.document),
                parentNode,
                updateExtensionState = function (extension) {
                    if (typeof extension.checkState === 'function') {
                        extension.checkState(parentNode);
                    } else if (typeof extension.isActive === 'function' &&
                               typeof extension.isAlreadyApplied === 'function' &&
                               typeof extension.setActive === 'function') {
                        if (!extension.isActive() && extension.isAlreadyApplied(parentNode)) {
                            extension.setActive();
                        }
                    }
                };

            if (!selectionRange) {
                return;
            }

            // Loop through all extensions
            this.forEachExtension(function (extension) {
                // For those extensions where we can use document.queryCommandState(), do so
                if (typeof extension.queryCommandState === 'function') {
                    queryState = extension.queryCommandState();
                    // If queryCommandState returns a valid value, we can trust the browser
                    // and don't need to do our manual checks
                    if (queryState !== null) {
                        if (queryState && typeof extension.setActive === 'function') {
                            extension.setActive();
                        }
                        return;
                    }
                }
                // We can't use queryCommandState for this extension, so add to manualStateChecks
                manualStateChecks.push(extension);
            });

            parentNode = Selection.getSelectedParentElement(selectionRange);

            // Make sure the selection parent isn't outside of the contenteditable
            if (!this.getEditorElements().some(function (element) {
                    return Util.isDescendant(element, parentNode, true);
                })) {
                return;
            }

            // Climb up the DOM and do manual checks for whether a certain extension is currently enabled for this node
            while (parentNode) {
                manualStateChecks.forEach(updateExtensionState);

                // we can abort the search upwards if we leave the contentEditable element
                if (Util.isMediumEditorElement(parentNode)) {
                    break;
                }
                parentNode = parentNode.parentNode;
            }
        }

        // Positioning toolbar

        positionToolbarIfShown() {
            if (this.isDisplayed()) {
                this.setToolbarPosition();
            }
        }

        setToolbarPosition() {
            var container = this.base.getFocusedElement(),
                selection = this.window.getSelection(),
                anchorPreview;

            // If there isn't a valid selection, bail
            if (!container) {
                return this;
            }

            if (this.static && !this.relativeContainer) {
                this.showToolbar();
                this.positionStaticToolbar(container);
            } else if (!selection.isCollapsed) {
                this.showToolbar();

                // we don't need any absolute positioning if relativeContainer is set
                if (!this.relativeContainer) {
                    this.positionToolbar(selection);
                }
            }

            anchorPreview = this.base.getExtensionByName('anchor-preview');

            if (anchorPreview && typeof anchorPreview.hidePreview === 'function') {
                anchorPreview.hidePreview();
            }
        }

        positionStaticToolbar(container) {
            // position the toolbar at left 0, so we can get the real width of the toolbar
            this.getToolbarElement().style.left = '0';

            // document.documentElement for IE 9
            var scrollTop = (this.document.documentElement && this.document.documentElement.scrollTop) || this.document.body.scrollTop,
                windowWidth = this.window.innerWidth,
                toolbarElement = this.getToolbarElement(),
                containerRect = container.getBoundingClientRect(),
                containerTop = containerRect.top + scrollTop,
                containerCenter = (containerRect.left + (containerRect.width / 2)),
                toolbarHeight = toolbarElement.offsetHeight,
                toolbarWidth = toolbarElement.offsetWidth,
                halfOffsetWidth = toolbarWidth / 2,
                targetLeft;

            if (this.sticky) {
                // If it's beyond the height of the editor, position it at the bottom of the editor
                if (scrollTop > (containerTop + container.offsetHeight - toolbarHeight)) {
                    toolbarElement.style.top = (containerTop + container.offsetHeight - toolbarHeight) + 'px';
                    toolbarElement.classList.remove('medium-editor-sticky-toolbar');

                // Stick the toolbar to the top of the window
                } else if (scrollTop > (containerTop - toolbarHeight)) {
                    toolbarElement.classList.add('medium-editor-sticky-toolbar');
                    toolbarElement.style.top = '0px';

                // Normal static toolbar position
                } else {
                    toolbarElement.classList.remove('medium-editor-sticky-toolbar');
                    toolbarElement.style.top = containerTop - toolbarHeight + 'px';
                }
            } else {
                toolbarElement.style.top = containerTop - toolbarHeight + 'px';
            }

            switch (this.align) {
                case 'left':
                    targetLeft = containerRect.left;
                    break;

                case 'right':
                    targetLeft = containerRect.right - toolbarWidth;
                    break;

                case 'center':
                    targetLeft = containerCenter - halfOffsetWidth;
                    break;
            }

            if (targetLeft < 0) {
                targetLeft = 0;
            } else if ((targetLeft + toolbarWidth) > windowWidth) {
                targetLeft = (windowWidth - Math.ceil(toolbarWidth) - 1);
            }

            toolbarElement.style.left = targetLeft + 'px';
        }

        positionToolbar(selection) {
            // position the toolbar at left 0, so we can get the real width of the toolbar
            this.getToolbarElement().style.left = '0';

            var windowWidth = this.window.innerWidth,
                range = selection.getRangeAt(0),
                boundary = range.getBoundingClientRect(),
                middleBoundary = (boundary.left + boundary.right) / 2,
                toolbarElement = this.getToolbarElement(),
                toolbarHeight = toolbarElement.offsetHeight,
                toolbarWidth = toolbarElement.offsetWidth,
                halfOffsetWidth = toolbarWidth / 2,
                buttonHeight = 50,
                defaultLeft = this.diffLeft - halfOffsetWidth;

            if (boundary.top < buttonHeight) {
                toolbarElement.classList.add('medium-toolbar-arrow-over');
                toolbarElement.classList.remove('medium-toolbar-arrow-under');
                toolbarElement.style.top = buttonHeight + boundary.bottom - this.diffTop + this.window.pageYOffset - toolbarHeight + 'px';
            } else {
                toolbarElement.classList.add('medium-toolbar-arrow-under');
                toolbarElement.classList.remove('medium-toolbar-arrow-over');
                toolbarElement.style.top = boundary.top + this.diffTop + this.window.pageYOffset - toolbarHeight + 'px';
            }

            if (middleBoundary < halfOffsetWidth) {
                toolbarElement.style.left = defaultLeft + halfOffsetWidth + 'px';
            } else if ((windowWidth - middleBoundary) < halfOffsetWidth) {
                toolbarElement.style.left = windowWidth + defaultLeft - halfOffsetWidth + 'px';
            } else {
                toolbarElement.style.left = defaultLeft + middleBoundary + 'px';
            }
        }
    }

    module.exports = Toolbar;