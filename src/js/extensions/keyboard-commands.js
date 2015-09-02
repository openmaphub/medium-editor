var Extension = require('../extension');
var Util = require('../util');
class KeyboardCommands extends Extension {

  constructor(opts) {
      super(opts);

        this.name = opts.name ? opts.name : 'keyboard-commands';

        /* KeyboardCommands Options */

        /* commands: [Array]
         * Array of objects describing each command and the combination of keys that will trigger it
         * Required for each object:
         *   command [String] (argument passed to editor.execAction())
         *   key [String] (keyboard character that triggers this command)
         *   meta [boolean] (whether the ctrl/meta key has to be active or inactive)
         *   shift [boolean] (whether the shift key has to be active or inactive)
         *   alt [boolean] (whether the alt key has to be active or inactive)
         */
        this.commands = opts.commands ? opts.comands : [
            {
                command: 'bold',
                key: 'B',
                meta: true,
                shift: false,
                alt: false
            },
            {
                command: 'italic',
                key: 'I',
                meta: true,
                shift: false,
                alt: false
            },
            {
                command: 'underline',
                key: 'U',
                meta: true,
                shift: false,
                alt: false
            }
        ];

        this.subscribe('editableKeydown', this.handleKeydown.bind(this));
        this.keys = {};
        this.commands.forEach(function (command) {
            var keyCode = command.key.charCodeAt(0);
            if (!this.keys[keyCode]) {
                this.keys[keyCode] = [];
            }
            this.keys[keyCode].push(command);
        }, this);
    }

    handleKeydown(event) {
        var keyCode = Util.getKeyCode(event);
        if (!this.keys[keyCode]) {
            return;
        }

        var isMeta = Util.isMetaCtrlKey(event),
            isShift = !!event.shiftKey,
            isAlt = !!event.altKey;

        this.keys[keyCode].forEach(function (data) {
            if (data.meta === isMeta &&
                data.shift === isShift &&
                (data.alt === isAlt ||
                 undefined === data.alt)) { // TODO deprecated: remove check for undefined === data.alt when jumping to 6.0.0
                event.preventDefault();
                event.stopPropagation();

                // command can be false so the shortcut is just disabled
                if (false !== data.command) {
                    this.execAction(data.command);
                }
            }
        }, this);
    }
}

module.exports = KeyboardCommands;
