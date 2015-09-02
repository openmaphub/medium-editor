
    var CLASS_DRAG_OVER = 'medium-editor-dragover';

    var Util = require('../util');
    var Extension = require('../extension');

    function clearClassNames(element) {
        var editable = Util.getContainerEditorElement(element),
            existing = Array.prototype.slice.call(editable.parentElement.querySelectorAll('.' + CLASS_DRAG_OVER));

        existing.forEach(function (el) {
            el.classList.remove(CLASS_DRAG_OVER);
        });
    }

    class FileDragging extends Extension {


      constructor(opts) {
          super(opts);

            this.name = opts.name ? opts.name : 'fileDragging';

            this.allowedTypes = opts.allowedTypes ? opts.allowedTypes : ['image'];

            this.subscribe('editableDrag', this.handleDrag.bind(this));
            this.subscribe('editableDrop', this.handleDrop.bind(this));
        }

        handleDrag(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';

            var target = event.target.classList ? event.target : event.target.parentElement;

            // Ensure the class gets removed from anything that had it before
            clearClassNames(target);

            if (event.type === 'dragover') {
                target.classList.add(CLASS_DRAG_OVER);
            }
        }

        handleDrop(event) {
            // Prevent file from opening in the current window
            event.preventDefault();
            event.stopPropagation();

            // IE9 does not support the File API, so prevent file from opening in the window
            // but also don't try to actually get the file
            if (event.dataTransfer.files) {
                Array.prototype.slice.call(event.dataTransfer.files).forEach(function (file) {
                    if (this.isAllowedFile(file)) {
                        if (file.type.match('image')) {
                            this.insertImageFile(file);
                        }
                    }
                }, this);
            }

            // Make sure we remove our class from everything
            clearClassNames(event.target);
        }

        isAllowedFile(file) {
            return this.allowedTypes.some(function (fileType) {
                return !!file.type.match(fileType);
            });
        }

        insertImageFile(file) {
            var fileReader = new FileReader();
            fileReader.readAsDataURL(file);

            var id = 'medium-img-' + (+new Date());
            Util.insertHTMLCommand(this.document, '<img class="medium-editor-image-loading" id="' + id + '" />');

            fileReader.onload = function () {
                var img = this.document.getElementById(id);
                if (img) {
                    img.removeAttribute('id');
                    img.removeAttribute('class');
                    img.src = fileReader.result;
                }
            }.bind(this);
        }
    }

    module.exports = FileDragging;
