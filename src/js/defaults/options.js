
// summary: The default options hash used by the Editor
var _window = null, _document= null;
if (typeof window !== 'undefined'){
  _window = window;
  _document = document;
}
module.exports = {
  activeButtonClass: 'medium-editor-button-active',
  buttonLabels: false,
  delay: 0,
  disableReturn: false,
  disableDoubleReturn: false,
  disableEditing: false,
  autoLink: false,
  elementsContainer: false,
  contentWindow: _window,
  ownerDocument: _document,
  targetBlank: false,
  extensions: {},
  spellcheck: true
};
