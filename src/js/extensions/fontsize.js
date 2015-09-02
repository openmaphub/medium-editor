
var Util = require('../util');
var Form = require('./form');
var Selection = require('../selection');

class FontSizeForm extends Form {

  constructor(opts) {
      super(opts);

        this.name = opts.name ? opts.name : 'fontsize';
        this.action = opts.action ? opts.action : 'fontSize';
        this.aria = opts.aria ? opts.aria : 'increase/decrease font size';
        this.contentDefault = opts.contentDefault ? opts.contentDefault : '&#xB1;'; // ±
        this.contentFA = opts.contentFA ? opts.contentFA : '<i class="fa fa-text-height"></i>';
    }

    // Called when the button the toolbar is clicked
    // Overrides ButtonExtension.handleClick
    handleClick(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!this.isDisplayed()) {
            // Get fontsize of current selection (convert to string since IE returns this as number)
            var fontSize = this.document.queryCommandValue('fontSize') + '';
            this.showForm(fontSize);
        }

        return false;
    }

    // Called by medium-editor to append form to the toolbar
    getForm() {
        if (!this.form) {
            this.form = this.createForm();
        }
        return this.form;
    }

    // Used by medium-editor when the default toolbar is to be displayed
    isDisplayed() {
        return this.getForm().style.display === 'block';
    }

    hideForm() {
        this.getForm().style.display = 'none';
        this.getInput().value = '';
    }

    showForm(fontSize) {
        var input = this.getInput();

        this.base.saveSelection();
        this.hideToolbarDefaultActions();
        this.getForm().style.display = 'block';
        this.setToolbarPosition();

        input.value = fontSize || '';
        input.focus();
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

    doFormSave() {
        this.base.restoreSelection();
        this.base.checkSelection();
    }

    doFormCancel() {
        this.base.restoreSelection();
        this.clearFontSize();
        this.base.checkSelection();
    }

    // form creation and event handling
    createForm() {
        var doc = this.document,
            form = doc.createElement('div'),
            input = doc.createElement('input'),
            close = doc.createElement('a'),
            save = doc.createElement('a');

        // Font Size Form (div)
        form.className = 'medium-editor-toolbar-form';
        form.id = 'medium-editor-toolbar-form-fontsize-' + this.getEditorId();

        // Handle clicks on the form itself
        this.on(form, 'click', this.handleFormClick.bind(this));

        // Add font size slider
        input.setAttribute('type', 'range');
        input.setAttribute('min', '1');
        input.setAttribute('max', '7');
        input.className = 'medium-editor-toolbar-input';
        form.appendChild(input);

        // Handle typing in the textbox
        this.on(input, 'change', this.handleSliderChange.bind(this));

        // Add save buton
        save.setAttribute('href', '#');
        save.className = 'medium-editor-toobar-save';
        save.innerHTML = this.getEditorOption('buttonLabels') === 'fontawesome' ?
                         '<i class="fa fa-check"></i>' :
                         '&#10003;';
        form.appendChild(save);

        // Handle save button clicks (capture)
        this.on(save, 'click', this.handleSaveClick.bind(this), true);

        // Add close button
        close.setAttribute('href', '#');
        close.className = 'medium-editor-toobar-close';
        close.innerHTML = this.getEditorOption('buttonLabels') === 'fontawesome' ?
                          '<i class="fa fa-times"></i>' :
                          '&times;';
        form.appendChild(close);

        // Handle close button clicks
        this.on(close, 'click', this.handleCloseClick.bind(this));

        return form;
    }

    getInput() {
        return this.getForm().querySelector('input.medium-editor-toolbar-input');
    }

    clearFontSize() {
        Selection.getSelectedElements(this.document).forEach(function (el) {
            if (el.nodeName.toLowerCase() === 'font' && el.hasAttribute('size')) {
                el.removeAttribute('size');
            }
        });
    }

    handleSliderChange() {
        var size = this.getInput().value;
        if (size === '4') {
            this.clearFontSize();
        } else {
            this.execAction('fontSize', {size});
        }
    }

    handleFormClick(event) {
        // make sure not to hide form when clicking inside the form
        event.stopPropagation();
    }

    handleSaveClick(event) {
        // Clicking Save -> create the font size
        event.preventDefault();
        this.doFormSave();
    }

    handleCloseClick(event) {
        // Click Close -> close the form
        event.preventDefault();
        this.doFormCancel();
    }
}

module.exports = FontSizeForm;
