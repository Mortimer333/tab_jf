class TabJF {
  editor;
  lastX        = 0;
  clipboard    = [];
  docEventsSet = false;
  copiedHere   = false;
  activated    = false;

  stack = {
    open      : true,
    building  : [], // currently building trace
    trace     : [], // array of seperate builds (each time a function was called this contain debug info about it, with arguments)
  };

  pressed = {
    shift : false,
    ctrl  : false,
    alt   : false,
  }

  pos = {
    letter : null,
    line   : null,
    el     : null,
  }

  selection = {
    update   : false,
    anchor   : null ,
    offset   : -1   ,
    line     : -1   ,
    reverse  : false,
    active   : false,
    expanded : false,
    start : {
      line   : -1,
      letter : -1,
      node   : -1,
    },
    end : {
      line   : -1,
      letter : -1,
      node   : -1,
    },
  }

  constructor( editor, set = {}, debugMode = false ) {
    if ( typeof editor?.nodeType == 'undefined') throw new Error('You can\'t create Editor JF without passing node to set as editor.');
    if ( editor.nodeType != 1                  ) throw new Error('Editor node has to be of proper node type. (1)'                    );
    this.editor   = editor;
    this.editor.setAttribute('tabindex', '-1');
    this.editor.classList.add('tabjf_editor');
    set.left      = ( set.left    ||  0    );
    set.top       = ( set.top     ||  0    );
    set.line      = ( set.line    ||  20   );
    set.height    = ( set.height  ||  400  );
    set.addCss    = ( set.addCss  ||  true );
    this.settings = set;

    this.injectMethods();

    this._save.debounce = this._hidden.debounce( this._save.publish, 500 );

    // Proxy for VC
    const methodsSave = [
      ['remove', 'selected'],
      ['remove', 'one'     ],
      ['remove', 'word'    ],
      ['action', 'paste'   ],
      ['newLine'           ],
      ['mergeLine'         ],
      ['insert'            ],
    ];
    methodsSave.forEach(path => {
      this.set.preciseMethodsProxy(this, path);
    });

    // Setting debug modes which keeps track of all called methods, arguments, scope and results
    if (debugMode) {
      let methods    = Object.getOwnPropertyNames( TabJF.prototype );
      let properties = Object.getOwnPropertyNames( this );

      let consIndex = methods.indexOf('constructor');
      if ( consIndex > -1 ) methods.splice(consIndex, 1);

      let hiddenMethods = methods.concat(properties);
      this.set.methodsProxy(this, hiddenMethods);
    }

    this.assignEvents();
    this.caret.el = this.caret.create( this.editor );
    this.caret.hide();
    this.font.createLab();
    this.render.init();

    if ( set.addCss ) this.addRules();
  }

  injectMethods () {
    if ( !TabJF_Get ) {
      throw new Error('Get class not included');
    }

    const classes = [
      { instance : TabJF_Hidden , var : '_hidden' },
      { instance : TabJF_Save   , var : '_save', modules : [
        { instance : TabJF_Save_Set    , var : 'set'     },
        { instance : TabJF_Save_Content, var : 'content' },
      ]},
      { instance : TabJF_Action , var : 'action'  },
      { instance : TabJF_Caret  , var : 'caret', modules : [
        { instance : TabJF_Caret_Pos, var : 'pos' },
      ]},
      { instance : TabJF_Clear  , var : 'clear'   },
      { instance : TabJF_End    , var : 'end'     },
      { instance : TabJF_Event  , var : 'event'   },
      { instance : TabJF_Expand , var : 'expand'  },
      { instance : TabJF_Font   , var : 'font'    },
      { instance : TabJF_Get    , var : 'get'     },
      { instance : TabJF_Is     , var : 'is', modules : [
        { instance : TabJF_Is_Line, var : 'line' },
      ]},
      { instance : TabJF_Keys   , var : 'keys'    },
      { instance : TabJF_Remove , var : 'remove'  },
      { instance : TabJF_Render , var : 'render', modules : [
        { instance : TabJF_Render_Fill  , var : 'fill'   },
        { instance : TabJF_Render_Move  , var : 'move'   },
        { instance : TabJF_Render_Add   , var : 'add'    },
        { instance : TabJF_Render_Remove, var : 'remove' },
        { instance : TabJF_Render_Set   , var : 'set'    },
        { instance : TabJF_Render_Update, var : 'update' },
      ]},
      { instance : TabJF_Replace, var : 'replace' },
      { instance : TabJF_Set    , var : 'set'     },
      { instance : TabJF_Truck  , var : 'truck'   },
      { instance : TabJF_Update , var : 'update', modules : [
        { instance : TabJF_Update_Selection, var : 'selection' },
      ]},
    ];

    classes.forEach( classObj => {
      this.assignInjected( classObj );
    });
  }

  assignInjected(classObj, context = this) {
    const variable      = classObj.var;
    if (!context[variable]) {
      context[variable] = {};
    }

    const classInstance = classObj.instance;
    const getMethods    = Object.getOwnPropertyNames( classInstance.prototype );
    const instance      = new classInstance.prototype.constructor();
    if (!instance._name) {
      instance._name = classInstance.name
        .replace(this.constructor.name + '_' , '')
        .replaceAll('_', '.')
        .toLowerCase();
    }

    const getProps      = Object.getOwnPropertyNames( instance );
    getMethods.forEach( name => {
      if (name != 'constructor') {
        context[variable][name] = classInstance.prototype[name].bind(this);
      }
    });

    getProps.forEach( name => {
      context[variable][name] = instance[name];
    });

    if (classObj?.modules) {
      classObj.modules.forEach( moduleObj => {
        this.assignInjected(moduleObj, this[variable]);
      });
    }
  }

  addRules () {
    const css = window.document.styleSheets[0];
    const rules = [
      `.tabjf_editor-con {
        max-height : calc( var(--max-height, 200) * 1px);
        overflow   : auto;
      }`,
      `.tabjf_editor {
        position    : relative;
        min-height  : calc( (var(--min-height, 0) - var(--paddingTop, 0)) * 1px);
        padding-top : calc( var(--paddingTop, 0) * 1px )                        ;
        width       : calc(var(--scroll-width, 100%) * 1px + 5px )              ;
      }`,
      `.tabjf_editor p {
        position   : relative;
        min-height : 20px    ;
        max-height : 20px    ;
        height     : 20px    ;
        cursor     : text    ;
        display    : flex    ;
        margin     : 0       ;
        padding    : 0       ;
      }`,
      `.tabjf_editor p::after {
        display : block;
        content : '█'  ;
        opacity : 0    ;
      }`,
      `.tabjf_editor p span {
        display     : block ;
        white-space : nowrap;
        flex-shrink : 0     ;
      }`,
      `@keyframes tabjf_blink {
        0%   { opacity: 1; }
        50%  { opacity: 0; }
        100% { opacity: 1; }
      }`,
      `.tabjf_editor .caret {
        width     : 1px ;
        height    : 20px;
        position  : absolute;
        animation : tabjf_blink 1s linear infinite;
        background-color : #000;
      }`
    ];
    rules.forEach( rule => {
      css.insertRule(
        rule,
        css.cssRules.length
      );
    });
  }

  /**
   * Proxy handle object for debuging info
   * Saves whole stack of methods, their arguments and results
   */
  _proxyHandle = {
    main : this, // Saving `this` in current scope so can access the instance
    get : function (target, name, receiver) {
      // nothing for now
    },
    apply : function (target, scope, args) {
      const stack = this.main.stack;

      // Here we save the status of stack.open
      // which indicates if the current function is master caller.
      // Just after saving it we change its value to false so other
      // methods will have oldMaster set to `false` which will disallow them
      // finishing stack and moving it to trace
      let oldMaster = stack.open;
      stack.open = false;

      let results;
      stack.building.push({ name : target.name, args, res : results });
      if (target.bind) results = target.bind(this.main)(...args);
      else results = target(...args);
      stack.building[ stack.building.length - 1 ].res = results;

      // If oldMaster is set to true it means to master caller finished
      // its cycle and we can move stack to trace and do clearing operations
      if ( oldMaster ) {
        if ( stack.trace.length == 100 ) stack.trace.shift();
        stack.trace.push( stack.building );
        stack.building = [];
        stack.open     = true;
      }

      return results;
    }
  }

  /**
   * Proxy handle for VC
   */
  _proxySaveHandle = {
    main : this, // Saving `this` in current scope so can access the instance
    apply : function (target, scope, args) {
      const main = this.main;
      const save = main._save;
      save.debounce();

      const oldInProggress = save.inProgress;
      save.inProgress      = true;
      const step           = save.tmp.length;

      // Here we build methods stack so we can check what method called what
      save.methodsStack.push(target.name);

      let startLine = main.pos.line;
      const sel     = main.get.selection();
      if ( sel.type.toLowerCase() == 'range' ) {
        startLine = main.selection.start.line;
        if ( main.selection.start.line > main.selection.end.line ) {
          startLine = main.selection.end.line;
        }
      }

      save.set.add( target.name, args );

      const results = target.bind( main )( ...args );

      save.set.remove( target.name, args, step, startLine );

      // only move to pending if master function have finshed
      if ( !oldInProggress ) {
        save.methodsStack = [];
        save.inProgress   = false;
        save.moveToPending();
      }

      return results;
    }
  }

  getAttributes(el) {
    const attrsObj = [];
    for ( let att, i = 0, atts = el.attributes, n = atts.length; i < n; i++ ){
      att = atts[i];
      attrsObj.push({
        nodeName  : att.nodeName,
        nodeValue : att.nodeValue,
      });
    }
    return attrsObj;
  }

  assignEvents() {
    this.editor.addEventListener("mousedown", this.active.bind      ? this.active    .bind(this) : this.active    );
    this.editor.addEventListener("mouseup"  , this.stopSelect.bind  ? this.stopSelect.bind(this) : this.stopSelect);
    this.editor.addEventListener("focusout" , this.deactive.bind    ? this.deactive  .bind(this) : this.deactive  );
  }

  updateSelect( e ) {
    this.selection.update = true;
    // If this was called then some selection appeared
    const selection = this.get.selection();
    if (selection.type !== 'Range') return;
    this.selection.active = true;
    if ( selection.focusNode == this.editor ) return;
    this.selection.end = {
      line   : this.get.linePos( this.get.line( selection.focusNode ) ) + this.render.hidden,
      node   : this.get.childIndex( selection.focusNode.parentElement ),
      letter : selection.focusOffset,
    };
  }

  stopSelect( e ) {
    if (this.get.selection().type == 'Range') {
      const event = this.event.dispatch('tabJFSelectStop', {
        pos       : this.get.clonedPos(),
        event     : e,
        selection : this.get.clone(this.selection),
      });
      if ( event.defaultPrevented ) return;
    }

    this.selection.update = false;
    this.editor.removeEventListener('mousemove', this.updateSelect.bind ? this.updateSelect.bind(this) : this.updateSelect, true);
    this.checkSelect();
  }

  checkSelect() {
    if (!this.selection.active) return;

    const start  = this.selection.start;
    const end    = this.selection.end;
    let reversed = false;

    if ( start.line < this.render.hidden && end.line < this.render.hidden ) return;

    let lineEndPos          = end.line;
    let lineEndChildIndex   = end.node;
    let lineStartChildIndex = start.node;
    let firstLinePos, startLetter, endLetter;

    if (
      lineEndPos < start.line
      || lineEndPos == start.line && lineEndChildIndex < lineStartChildIndex
      || lineEndPos == start.line && lineEndChildIndex == lineStartChildIndex && end.letter < start.letter
    ) {
      reversed     = true;
      startLetter  = end.letter;
      endLetter    = start.letter;
      firstLinePos = lineEndPos;
      lineEndPos   = start.line;
      const tmp    = lineStartChildIndex;
      lineStartChildIndex = lineEndChildIndex;
      lineEndChildIndex   = tmp;
    } else {
      startLetter  = start.letter;
      endLetter    = end.letter;
      firstLinePos = start.line;
    }

    if (firstLinePos < this.render.hidden || (this.selection.update && firstLinePos >= this.render.hidden + this.render.linesLimit)) {
      firstLinePos        = this.render.hidden;
      startLetter         = 0;
      lineStartChildIndex = 0;
      endLetter           = end.letter;
    }

    if (lineEndPos >= this.render.hidden + this.render.linesLimit) {
      lineEndPos = this.render.hidden + this.render.linesLimit - 1;
      let endLine = this.get.lineByPos(lineEndPos);
      let endChild = endLine.children[ endLine.children.length - 1 ];
      lineEndChildIndex = endChild.childNodes.length - 1;
      endLetter = endChild.childNodes[ endChild.childNodes.length - 1 ].nodeValue.length;
    }

    let firstText = this.get.lineByPos(firstLinePos)
    let lastText  = this.get.lineByPos(lineEndPos  )
    if (!firstText || !lastText) {
      return;
    }

    if (!firstText.children[ lineStartChildIndex ]) {
      console.log(firstText, lineStartChildIndex);
    }
    firstText = firstText.children[ lineStartChildIndex ].childNodes[0];
    lastText  = lastText .children[ lineEndChildIndex   ].childNodes[0];
    const range = new Range();
    const firstTextLength = firstText.nodeValue.length;
    const lastTextLength = lastText.nodeValue.length;
    if (firstTextLength < startLetter) {
      startLetter = firstTextLength;
    }
    if (lastTextLength < endLetter) {
      endLetter = lastTextLength;
    }
    range.setStart(firstText, startLetter);
    range.setEnd  (lastText , endLetter  );
    this.get.selection().removeAllRanges();
    this.get.selection().addRange(range);
  }

  active( e ) {
    const event = this.event.dispatch('tabJFActivate', {
      pos       : this.get.clonedPos(),
      event     : e,
    });
    if ( event.defaultPrevented ) return;

    if ( e.target == this.editor  ||  e.layerX < 0  ||  e.layerY < 0 ) return;
    let el = e.target;
    if ( el.nodeName === "P") el = el.children[ el.children.length - 1 ];

    let left = e.layerX;
    if ( el.offsetWidth + el.offsetLeft < left ) {
      left = el.offsetWidth + el.offsetLeft;
    }

    let y = this.caret.pos.toY( el.parentElement.offsetTop + this.settings.top );
    let line = Math.ceil ( ( y - this.settings.top ) / this.settings.line );
    const letter = this.font.getLetterByWidth( left, el );
    this.caret.show();
    const index  = this.get.childIndex( el );
    this.caret.refocus(
      letter,
      line,
      index,
    );

    if ( line < this.render.hidden + 2 && this.render.hidden > 0 ) {
      this.render.set.overflow( null, ( line - 2 ) * this.settings.line );
    } else if ( line > this.render.hidden + this.render.linesLimit - 5 ) {
      this.render.set.overflow( null, ( line - ( this.render.linesLimit - 5 ) ) * this.settings.line );
    }

    this.lastX            = this.get.realPos().x;
    this.selection.start  = { line : line, letter, node : index };
    this.selection.active = false;
    this.editor.addEventListener(
      'mousemove',
      this.updateSelect.bind ? this.updateSelect.bind(this) : this.updateSelect,
      true
    );
    this.activated = true;
    this.resetPressed();
    this.set.docEvents();
  }

  resetPressed() {
    this.pressed.ctrl  = false;
    this.pressed.shift = false;
    this.pressed.alt   = false;
  }

  deactive( e ) {
    const event = this.event.dispatch('tabJFDeactivate', {
      pos       : this.get.clonedPos(),
      event     : e,
    });
    if ( event.defaultPrevented ) return;

    this.remove.docEvents();
    this.copiedHere = false;
    this.activated  = false;
  }

  updateSpecialKeys( e ) {
    // Clicking Alt also triggers Ctrl ?????? wierd stuff man
    if ( !e.altKey ) {
      this.pressed.ctrl = e.ctrlKey;
    } else {
      this.pressed.ctrl = false;
    }
    // If shift key was just clicked
    if ( !this.pressed.shift && e.shiftKey ) {
      this.selection.active = true;
      this.update.selection.start()
    } else if ( !e.shiftKey && this.get.selection().type != "Range") {
      this.selection.active = false;
    }
    this.pressed.shift = e.shiftKey;
    this.pressed.alt   = e.altKey  ;
  }

  key ( e ) {
    const type = e.type;

    if ( type == 'keydown' ) {
      const event = this.event.dispatch('tabJFKeyDown', {
        pos   : this.get.clonedPos(),
        event : e,
      });
      if ( event.defaultPrevented ) return;
    } else if ( type == 'keyup' ) {
      const event = this.event.dispatch('tabJFKeyUp', {
        pos   : this.get.clonedPos(),
        event : e,
      });
      if ( event.defaultPrevented ) return;
    }

    this.updateSpecialKeys( e );
    if ( type == 'keyup' ) {
      return;
    }

    const prevent = {
      33 : true,
      34 : true,
      35 : true,
      36 : true,
      37 : true,
      38 : true,
      39 : true,
      40 : true,
      222 : true
    };

    const skip = {
      /* F1 - F12 */
      112 : true,
      113 : true,
      114 : true,
      115 : true,
      116 : true,
      117 : true,
      118 : true,
      119 : true,
      120 : true,
      121 : true,
      122 : true,
      123 : true,
      /*/ F1 - F12 */
    };

    if ( skip   [ e.keyCode ] ) return;
    if ( prevent[ e.keyCode ] ) e.preventDefault();

    const keys = {
      0 : ( e, type ) => {
        // MediaTrackNext And MediaTrackPrevious and MediaPlayPause ??? I guees the 0 is a fillup for unknown codes
      },
      8 : ( e, type ) => {
        this.keys.backspace( e );
      },
      9 : ( e, type ) => {
        this.keys.tab( e );
      },
      13 : ( e, type ) => {
        this.keys.enter( e );
      },
      16 : ( e, type ) => {
        // shift
        const selection = this.get.selection();
        if (selection.type == 'Caret') {
          this.update.selection.start();
        }
      },
      17 : ( e, type ) => {
        // control
      },
      18 : ( e, type ) => {
        // alt
      },
      18 : ( e, type ) => {
        // pause ?
      },
      20 : ( e, type ) => {
        // CAPS
      },
      27 : ( e, type ) => {
        this.keys.escape( e );
      },
      32 : ( e, type ) => {
        e.preventDefault();
        this.keys.space( e );
      },
      33 : ( e, type ) => {
        this.toSide( -1, -1 ); // Page up
      },
      34 : ( e, type ) => {
        this.toSide( 1, 1 ); // Page down
      },
      35 : ( e, type ) => {
        this.toSide( 1, 0 ); // End
      },
      36 : ( e, type ) => {
        this.toSide( -1, 0 ); // Home
      },
      46 : ( e, type ) => {
        this.keys.delete( e );
      },

      // Move keys
      37 : ( e, type ) => {
        this.keys.move(-1, 0);
        const event = this.event.dispatch('tabJFMove', {
          pos       : this.get.clonedPos(),
          event     : e,
          selection : this.get.clone(this.selection),
          x         : -1,
          y         : 0,
        });
        if ( event.defaultPrevented ) return;
      },
      38 : ( e, type ) => {
        const event = this.event.dispatch('tabJFMove', {
          pos       : this.get.clonedPos(),
          event     : e,
          selection : this.get.clone(this.selection),
          x         : 0,
          y         : -1,
        });
        if ( event.defaultPrevented ) return;
        this.keys.move(0, -1);
      },
      39 : ( e, type ) => {
        const event = this.event.dispatch('tabJFMove', {
          pos       : this.get.clonedPos(),
          event     : e,
          selection : this.get.clone(this.selection),
          x         : 1,
          y         : 0,
        });
        if ( event.defaultPrevented ) return;
        this.keys.move(1, 0);
      },
      40 : ( e, type ) => {
        const event = this.event.dispatch('tabJFMove', {
          pos       : this.get.clonedPos(),
          event     : e,
          selection : this.get.clone(this.selection),
          x         : 0,
          y         : 1,
        });
        if ( event.defaultPrevented ) return;
        this.keys.move(0, 1);
      },

      45 : ( e, type ) => {
        // Insert
      },
      65 : ( e, type ) => { // a
        if ( this.pressed.ctrl ) {
          e.preventDefault();
          this.action.selectAll();
        } else {
          this.insert( e.key );
        }
      },
      67 : ( e, type ) => { // c
        if ( this.pressed.ctrl ) {
          this.action.copy();
        } else {
          this.insert( e.key );
        }
      },
      86 : ( e, type ) => { // v
        if ( !this.pressed.ctrl ) {
          this.insert( e.key );
        }
      },
      88 : ( e, type ) => { // x
        if ( this.pressed.ctrl ) {
          this.action.cut();
        } else {
          this.insert( e.key );
        }
      },
      89 : ( e, type ) => { // y
        if ( this.pressed.ctrl ) {
          this.action.redo();
        } else {
          this.insert( e.key );
        }
      },
      90 : ( e, type ) => { // z
        if ( this.pressed.ctrl ) {
          this.action.undo();
        } else {
          this.insert( e.key );
        }
      },
      91 : ( e, type ) => {
        // windows
      },
      106 : ( e, type ) => {
        // it's * but it should be * so lets insert proper for him
        this.insert('*');
      },
      109 : ( e, type ) => {
        // very buggy, it should just enter - but it sometimes enter new line too?
        this.insert('-');
      },
      111 : ( e, type ) => {
        // em it's / but it opens search?
        e.preventDefault();
      },
      144 : ( e, type ) => {
        // NumLock
      },
      145 : ( e, type ) => {
        // scroll lock
      },
      182 : ( e, type ) => {
        // AudioVolumeDown
      },
      183 : ( e, type ) => {
        // AudioVolumeUp
      },
      default : ( e, type ) => {
        throw new Error('Unknow special key', e.keyCode);
      }
    };

    let selDelSkip = { 'delete' : true, 'backspace' : true, 'escape' : true };
    const sel = this.get.selection();
    if (
      this.selection.active
      && !selDelSkip[ e.key.toLowerCase() ]
      && !this.pressed.ctrl
      && sel.type == "Range"
    ) {
      if ( !!this.keys[ e.key.toLowerCase() ]  ||  e.key.length == 1 ) {
        this.remove.selected();
      }
    }

    if ( !keys[ e.keyCode ] && e.key.length == 1 ) {
      this.insert( e.key );

      if ( !this.caret.isVisible() ) {
        this.render.set.overflow(
          null,
          (this.pos.line - (this.render.linesLimit/2)) * this.settings.line
        );
      }
      return;
    }

    ( keys[e.keyCode]  ||  keys['default'] )( e, type );

    this.updateCurrentLine();
  }

  updateCurrentLine() {
    const line = this.pos.line;
    // Line we want to save if hidden
    if ( !this.is.line.visible( line ) ) {
      return;
    }
    const exportedLine = this.truck.exportLine(
      this.get.lineByPos( line )
    );
    this.render.content[ line ] = exportedLine;
  }

  toSide( dirX, dirY ) {
    let line   = this.pos.line;
    let letter = this.pos.letter;
    let node   = this.pos.childIndex;

    if ( dirY > 0 ) {
      line = this.render.content.length - 1;
    } else if ( dirY < 0 ) {
      line = 0;
    }

    if ( dirX > 0 ) {
      let lineContent = this.render.content[ line ];
      node            = lineContent.content.length - 1;
      let lastSpan    = lineContent.content[ lineContent.content.length - 1 ];
      letter          = lastSpan.content.length;
    } else if ( dirX < 0 ) {
      letter = 0;
      node   = 0;
    }

    // Check if chosen line has needed amount of nodes and letters
    const chosenLine = this.render.content[ line ];
    if ( chosenLine.content.length - 1 < node ) {
      node = chosenLine.content.length - 1;
    }

    if ( chosenLine.content[ node ].content.length < letter) {
      letter = chosenLine.content[ node ].content.length;
    }

    this.caret.refocus(
      letter,
      line,
      node
    );
  }

  newLine() {
    let el = this.pos.el, text = this.getSplitRow();
    if ( text.pre.innerText.length > 0 ) {
      el.parentElement.insertBefore( text.pre, el );
      el.remove();
      el = text.pre;
    } else {
      el.innerHTML = '';
      el.appendChild( document.createTextNode('') );
    }
    this.render.content[ this.pos.line ] = this.truck.exportLine( el.parentElement );
    let newLine  = document.createElement("p");
    let appended = [];

    text.suf.forEach( span => {
      if ( span.innerText.length > 0 ) {
        newLine.appendChild( span );
        appended.push( span );
      }
    });
    if ( appended.length == 0 ) {
      text.suf[0].appendChild( document.createTextNode('') );
      newLine.appendChild( text.suf[0] );
      appended.push( text.suf[0] );
    }
    this.render.content.splice(
      this.pos.line + 1,
      0,
      this.truck.exportLine( newLine )
    );
    if ( this.pos.line + 1 > this.render.hidden + this.render.linesLimit - 6 ) {
      this.render.set.overflow(
        null,
        ( this.pos.line - ( this.render.linesLimit - 6 ) ) * this.settings.line
      );
      this.render.move.page( this.pos.line - ( this.render.linesLimit - 6 ) );
    } else {
      this.render.move.page();
    }
    this.caret.refocus( 0, this.pos.line + 1, 0 );
  }

  mergeLine( dir ) {
    let line = this.get.line( this.pos.el );
    if ( line.nodeName != "P") throw new Error("Parent has wrong tag, can't merge lines");
    if ( dir < 0 ) { // Backspace
      let previous = this.get.lineInDirection( line, dir );
      if ( !previous ) return; // do nothing

      let oldLast = previous.children[ previous.children.length - 1 ];
      for ( let i = line.children.length - 1; i >= 0 ; i-- ) {
        if ( line.children[0].innerText.length > 0 ) previous.appendChild( line.children[0] );
        else line.children[0].remove();
      }
      line.remove();
      this.pos.line = this.pos.line - 1;
      this.toSide(1, 0);
      this.lastX = this.get.realPos().x;
      this.render.remove.line(this.pos.line);

    } else if ( dir > 0 ) { // Delete
      let next = this.get.lineInDirection( line, dir );
      if ( !next ) return; // do nothing

      for ( let i = next.children.length - 1; i >= 0 ; i-- ) {
        if ( next.children[0].innerText.length > 0 ) line.appendChild( next.children[0] );
        else                                         next.children[0].remove();
      }

      next.remove();
      this.render.remove.line(this.pos.line + 1);
    }
  }

  insert( key ) {
    let text = this.replace.spaceChars(
      this.render.content[ this.pos.line ].content[ this.pos.childIndex ].content
    );
    text = {
      pre : text.substr( 0, this.pos.letter ),
      suf : text.substr( this.pos.letter    )
    }
    this.pos.el.innerHTML = text.pre + key + text.suf;
    this.render.content[this.pos.line].content[ this.pos.childIndex ].content = text.pre + key + text.suf;
    this.caret.refocus( this.pos.letter + this.replace.spaceChars( key ).length );
    this.lastX++;
  }

  getSplitNode() {
    let text = this.pos.el.innerText;
    return {
      pre : this.setAttributes( this.pos.el.attributes, text.substr( 0, this.pos.letter ) ),
      suf : this.setAttributes( this.pos.el.attributes, text.substr( this.pos.letter    ) )
    }
  }

  setAttributes(attributes, text) {
    let newSpan = document.createElement("span");
    for ( let att, i = 0, atts = attributes, n = atts.length; i < n; i++ ){
      att = atts[i];
      newSpan.setAttribute( att.nodeName, att.nodeValue );
    }
    newSpan.innerHTML = text;
    return newSpan;
  }

  getSplitRow() {
    let local = this.getSplitNode();
    let nodes = this.getNextSiblignAndRemove( this.pos.el.nextSibling );
    local.suf = [ local.suf, ...nodes ];
    return local;
  }

  getNextSiblignAndRemove( el ) {
    if ( el === null ) return [];
    let nodes = [];

    let span = this.setAttributes( el.attributes, el.innerText );
    nodes.push( span );
    if ( el.nextSibling ) {
      let nextSpan = this.getNextSiblignAndRemove( el.nextSibling );
      nodes = nodes.concat( nextSpan );
    }

    el.remove();
    return nodes;
  }

  catchClipboard( e ) {
    if (!this.activated) {
      return;
    }

    // If user used internal method action.copy to copy content of this editor
    // don't transform the clipboard
    if ( !this.copiedHere ) {
      let paste = ( event.clipboardData || window.clipboardData ).getData('text');
      this.clipboard = this.truck.exportText( paste );
    }

    this.action.paste();
  }
}
