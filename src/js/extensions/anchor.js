
    var Util = require('../util');
    var Form = require('./form');
    var Selection = require('../selection');
    class AnchorForm extends Form {

      constructor(opts) {
          super(opts);

            /* Anchor Form Options */

            /* customClassOption: [string]  (previously options.anchorButton + options.anchorButtonClass)
             * Custom class name the user can optionally have added to their created links (ie 'button').
             * If passed as a non-empty string, a checkbox will be displayed allowing the user to choose
             * whether to have the class added to the created link or not.
             */
            this.customClassOption = opts.customClassOption ? opts.customClassOption : null;

            /* customClassOptionText: [string]
             * text to be shown in the checkbox when the __customClassOption__ is being used.
             */
            this.customClassOptionText = opts.customClassOptionText ? opts.customClassOptionText : 'Button';

            /* linkValidation: [boolean]  (previously options.checkLinkFormat)
             * enables/disables check for common URL protocols on anchor links.
             */
            this.linkValidation = opts.linkValidation ? opts.linkValidation : false;

            /* placeholderText: [string]  (previously options.anchorInputPlaceholder)
             * text to be shown as placeholder of the anchor input.
             */
            this.placeholderText = opts.placeholderText ? opts.placeholderText : 'Paste or type a link';

            /* targetCheckbox: [boolean]  (previously options.anchorTarget)
             * enables/disables displaying a "Open in new window" checkbox, which when checked
             * changes the `target` attribute of the created link.
             */
            this.targetCheckbox = opts.targetCheckbox ? opts.targetCheckbox : false;

            /* targetCheckboxText: [string]  (previously options.anchorInputCheckboxLabel)
             * text to be shown in the checkbox enabled via the __targetCheckbox__ option.
             */
            this.targetCheckboxText = opts.targetCheckboxText ? opts.targetCheckboxText : 'Open in new window';

            // Options for the Button base class
            this.name = 'anchor';
            this.action = 'createLink';
            this.aria = 'link';
            this.tagNames = ['a'];
            this.contentDefault = '<b>#</b>';
            this.contentFA = '<i class="fa fa-link"></i>';

            this.subscribe('editableKeydown', this.handleKeydown.bind(this));
        }

        // Called when the button the toolbar is clicked
        // Overrides ButtonExtension.handleClick
        handleClick(event) {
            event.preventDefault();
            event.stopPropagation();

            var range = Selection.getSelectionRange(this.document);

            if (range.startContainer.nodeName.toLowerCase() === 'a' ||
                range.endContainer.nodeName.toLowerCase() === 'a' ||
                Util.getClosestTag(Selection.getSelectedParentElement(range), 'a')) {
                return this.execAction('unlink');
            }

            if (!this.isDisplayed()) {
                this.showForm();
            }

            return false;
        }

        // Called when user hits the defined shortcut (CTRL / COMMAND + K)
        handleKeydown(event) {
            if (Util.isKey(event, Util.keyCode().K) && Util.isMetaCtrlKey(event) && !event.shiftKey) {
                this.handleClick(event);
            }
        }

        // Called by medium-editor to append form to the toolbar
        getForm() {
            if (!this.form) {
                this.form = this.createForm();
            }
            return this.form;
        }

        getTemplate() {
            var template = [
                '<input type="text" class="medium-editor-toolbar-input" placeholder="', this.placeholderText, '">'
            ];

            template.push(
                '<a href="#" class="medium-editor-toolbar-save">',
                this.getEditorOption('buttonLabels') === 'fontawesome' ? '<i class="fa fa-check"></i>' : this.formSaveLabel,
                '</a>'
            );

            template.push('<a href="#" class="medium-editor-toolbar-close">',
                this.getEditorOption('buttonLabels') === 'fontawesome' ? '<i class="fa fa-times"></i>' : this.formCloseLabel,
                '</a>');

            // both of these options are slightly moot with the ability to
            // override the various form buildup/serialize functions.

            if (this.targetCheckbox) {
                // fixme: ideally, this targetCheckboxText would be a formLabel too,
                // figure out how to deprecate? also consider `fa-` icon default implcations.
                template.push(
                    '<div class="medium-editor-toolbar-form-row">',
                    '<input type="checkbox" class="medium-editor-toolbar-anchor-target">',
                    '<label>',
                    this.targetCheckboxText,
                    '</label>',
                    '</div>'
                );
            }

            if (this.customClassOption) {
                // fixme: expose this `Button` text as a formLabel property, too
                // and provide similar access to a `fa-` icon default.
                template.push(
                    '<div class="medium-editor-toolbar-form-row">',
                    '<input type="checkbox" class="medium-editor-toolbar-anchor-button">',
                    '<label>',
                    this.customClassOptionText,
                    '</label>',
                    '</div>'
                );
            }

            return template.join('');

        }

        // Used by medium-editor when the default toolbar is to be displayed
        isDisplayed() {
            return this.getForm().style.display === 'block';
        }

        hideForm() {
            this.getForm().style.display = 'none';
            this.getInput().value = '';
        }

        showForm(opts) {
            var input = this.getInput(),
                targetCheckbox = this.getAnchorTargetCheckbox(),
                buttonCheckbox = this.getAnchorButtonCheckbox();

            opts = opts || {url: ''};
            // TODO: This is for backwards compatability
            // We don't need to support the 'string' argument in 6.0.0
            if (typeof opts === 'string') {
                opts = {
                    url: opts
                };
            }

            this.base.saveSelection();
            this.hideToolbarDefaultActions();
            this.getForm().style.display = 'block';
            this.setToolbarPosition();

            input.value = opts.url;
            input.focus();

            // If we have a target checkbox, we want it to be checked/unchecked
            // based on whether the existing link has target=_blank
            if (targetCheckbox) {
                targetCheckbox.checked = opts.target === '_blank';
            }

            // If we have a custom class checkbox, we want it to be checked/unchecked
            // based on whether an existing link already has the class
            if (buttonCheckbox) {
                var classList = opts.buttonClass ? opts.buttonClass.split(' ') : [];
                buttonCheckbox.checked = (classList.indexOf(this.customClassOption) !== -1);
            }
        }

        // Called by core when tearing down medium-editor (destroy)
        destroy() {
            if (!this.form) {
                return false;
            }

            if (this.form.parentNode) {
                this.form.parentNode.removeChild(this.form);
            }

            delete this.form;
        }

        // core methods

        getFormOpts() {
            // no notion of private functions? wanted `_getFormOpts`
            var targetCheckbox = this.getAnchorTargetCheckbox(),
                buttonCheckbox = this.getAnchorButtonCheckbox(),
                opts = {
                    url: this.getInput().value
                };

            if (this.linkValidation) {
                opts.url = this.checkLinkFormat(opts.url);
            }

            opts.target = '_self';
            if (targetCheckbox && targetCheckbox.checked) {
                opts.target = '_blank';
            }

            if (buttonCheckbox && buttonCheckbox.checked) {
                opts.buttonClass = this.customClassOption;
            }

            return opts;
        }

        doFormSave() {
            var opts = this.getFormOpts();
            this.completeFormSave(opts);
        }

        completeFormSave(opts) {
            this.base.restoreSelection();
            this.execAction(this.action, opts);
            this.base.checkSelection();
        }

        checkLinkFormat(value) {
            var re = /^(https?|ftps?|rtmpt?):\/\/|mailto:/;
            return (re.test(value) ? '' : 'http://') + value;
        }

        doFormCancel() {
            this.base.restoreSelection();
            this.base.checkSelection();
        }

        // form creation and event handling
        attachFormEvents(form) {
            var close = form.querySelector('.medium-editor-toolbar-close'),
                save = form.querySelector('.medium-editor-toolbar-save'),
                input = form.querySelector('.medium-editor-toolbar-input');

            // Handle clicks on the form itself
            this.on(form, 'click', this.handleFormClick.bind(this));

            // Handle typing in the textbox
            this.on(input, 'keyup', this.handleTextboxKeyup.bind(this));

            // Handle close button clicks
            this.on(close, 'click', this.handleCloseClick.bind(this));

            // Handle save button clicks (capture)
            this.on(save, 'click', this.handleSaveClick.bind(this), true);

        }

        createForm() {
            var doc = this.document,
                form = doc.createElement('div');

            // Anchor Form (div)
            form.className = 'medium-editor-toolbar-form';
            form.id = 'medium-editor-toolbar-form-anchor-' + this.getEditorId();
            form.innerHTML = this.getTemplate();
            this.attachFormEvents(form);

            return form;
        }

        getInput() {
            return this.getForm().querySelector('input.medium-editor-toolbar-input');
        }

        getAnchorTargetCheckbox() {
            return this.getForm().querySelector('.medium-editor-toolbar-anchor-target');
        }

        getAnchorButtonCheckbox() {
            return this.getForm().querySelector('.medium-editor-toolbar-anchor-button');
        }

        handleTextboxKeyup(event) {
            // For ENTER -> create the anchor
            if (event.keyCode === Util.keyCode().ENTER) {
                event.preventDefault();
                this.doFormSave();
                return;
            }

            // For ESCAPE -> close the form
            if (event.keyCode === Util.keyCode().ESCAPE) {
                event.preventDefault();
                this.doFormCancel();
            }
        }

        handleFormClick(event) {
            // make sure not to hide form when clicking inside the form
            event.stopPropagation();
        }

        handleSaveClick(event) {
            // Clicking Save -> create the anchor
            event.preventDefault();
            this.doFormSave();
        }

        handleCloseClick(event) {
            // Click Close -> close the form
            event.preventDefault();
            this.doFormCancel();
        }
    }

    module.exports = AnchorForm;
