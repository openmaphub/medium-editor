var MediumEditor = require('./core');
class Extension {
    /* init: [function]
     *
     * Called by MediumEditor during initialization.
     * The .base property will already have been set to
     * current instance of MediumEditor when this is called.
     * All helper methods will exist as well
     */
    constructor(options) {
      /* base: [MediumEditor instance]
       *
       * If not overriden, this will be set to the current instance
       * of MediumEditor, before the init method is called
       */
      this.base = options.base ? options.base : undefined;

      /* name: [string]
       *
       * 'name' of the extension, used for retrieving the extension.
       * If not set, MediumEditor will set this to be the key
       * used when passing the extension into MediumEditor via the
       * 'extensions' option
       */
      this.name = options.name ? options.name : undefined;

      /* checkState: [function (node)]
       *
       * If implemented, this function will be called one or more times
       * the state of the editor & toolbar are updated.
       * When the state is updated, the editor does the following:
       *
       * 1) Find the parent node containing the current selection
       * 2) Call checkState on the extension, passing the node as an argument
       * 3) Get the parent node of the previous node
       * 4) Repeat steps #2 and #3 until we move outside the parent contenteditable
       */
       if(options.checkState){
         this.checkState = options.checkState;
       }
      

      /* destroy: [function ()]
       *
       * This method should remove any created html, custom event handlers
       * or any other cleanup tasks that should be performed.
       * If implemented, this function will be called when MediumEditor's
       * destroy method has been called.
       */
      this.destroy = options.destroy ? options.destroy : undefined;

      /* As alternatives to checkState, these functions provide a more structured
       * path to updating the state of an extension (usually a button) whenever
       * the state of the editor & toolbar are updated.
       */

      /* queryCommandState: [function ()]
       *
       * If implemented, this function will be called once on each extension
       * when the state of the editor/toolbar is being updated.
       *
       * If this function returns a non-null value, the extension will
       * be ignored as the code climbs the dom tree.
       *
       * If this function returns true, and the setActive() function is defined
       * setActive() will be called
       */
      this.queryCommandState = options.queryCommandState ? options.queryCommandState : undefined;

      /* isActive: [function ()]
       *
       * If implemented, this function will be called when MediumEditor
       * has determined that this extension is 'active' for the current selection.
       * This may be called when the editor & toolbar are being updated,
       * but only if queryCommandState() or isAlreadyApplied() functions
       * are implemented, and when called, return true.
       */
      this.isActive = options.isActive ? options.isActive : undefined;

      /* isAlreadyApplied: [function (node)]
       *
       * If implemented, this function is similar to checkState() in
       * that it will be called repeatedly as MediumEditor moves up
       * the DOM to update the editor & toolbar after a state change.
       *
       * NOTE: This function will NOT be called if checkState() has
       * been implemented. This function will NOT be called if
       * queryCommandState() is implemented and returns a non-null
       * value when called
       */
      this.isAlreadyApplied = options.isAlreadyApplied ? options.isAlreadyApplied : undefined;

      /* setActive: [function ()]
       *
       * If implemented, this function is called when MediumEditor knows
       * that this extension is currently enabled.  Currently, this
       * function is called when updating the editor & toolbar, and
       * only if queryCommandState() or isAlreadyApplied(node) return
       * true when called
       */
      this.setActive = options.setActive ? options.setActive : undefined;

      /* setInactive: [function ()]
       *
       * If implemented, this function is called when MediumEditor knows
       * that this extension is currently disabled.  Curently, this
       * is called at the beginning of each state change for
       * the editor & toolbar. After calling this, MediumEditor
       * will attempt to update the extension, either via checkState()
       * or the combination of queryCommandState(), isAlreadyApplied(node),
       * isActive(), and setActive()
       */
      this.setInactive = options.setInactive ? options.setInactive : undefined;

      /************************ Helpers ************************
       * The following are helpers that are either set by MediumEditor
       * during initialization, or are helper methods which either
       * route calls to the MediumEditor instance or provide common
       * functionality for all extensions
       *********************************************************/

      /* window: [Window]
       *
       * If not overriden, this will be set to the window object
       * to be used by MediumEditor and its extensions.  This is
       * passed via the 'contentWindow' option to MediumEditor
       * and is the global 'window' object by default
       */
      this.window = options.window ? options.window : undefined;

      /* document: [Document]
       *
       * If not overriden, this will be set to the document object
       * to be used by MediumEditor and its extensions. This is
       * passed via the 'ownerDocument' optin to MediumEditor
       * and is the global 'document' object by default
       */
      this.document = options.document ? options.document : undefined;
    }



    /* getEditorElements: [function ()]
     *
     * Helper function which returns an array containing
     * all the contenteditable elements for this instance
     * of MediumEditor
     */
    getEditorElements() {
        return this.base.elements;
    }

    /* getEditorId: [function ()]
     *
     * Helper function which returns a unique identifier
     * for this instance of MediumEditor
     */
    getEditorId() {
        return this.base.id;
    }

    /* getEditorOptions: [function (option)]
     *
     * Helper function which returns the value of an option
     * used to initialize this instance of MediumEditor
     */
    getEditorOption(option) {
        return this.base.options[option];
    }

    /* List of method names to add to the prototype of Extension
     * Each of these methods will be defined as helpers that
     * just call directly into the MediumEditor instance.
     *
     * example for 'on' method:
     * Extension.prototype.on = function () {
     *     return this.base.on.apply(this.base, arguments);
     * }
     */

    execAction(){
      return this.base.execAction.apply(this.base, arguments);
    }

    on(){
      return this.base.on.apply(this.base, arguments);
    }
    off(){
      return this.base.off.apply(this.base, arguments);
    }

    subscribe(){
      return this.base.subscribe.apply(this.base, arguments);
    }

    trigger() {
      return this.base.trigger.apply(this.base, arguments);
    }
};

module.exports = Extension;
