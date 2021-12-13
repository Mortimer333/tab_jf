class TabJF_Caret {
  el       = null;
  isActive = false;

  isVisible () {
    return this.caret.isActive
    && (
      this.pos.line >= this.render.hidden
      && this.pos.line <= this.render.hidden + this.render.linesLimit
    );
  }

  scrollTo () {
    const caretLeft = this.get.realPos().x * this.settings.letter + this.settings.left;
    const caretTop  = ( this.pos.line + 1 ) * this.settings.line;
    const yPos      = caretTop - this.editor.offsetHeight > 0 ? caretTop - this.editor.offsetHeight : 0;

    if ( caretLeft > this.editor.offsetWidth - 20 ) this.editor.scrollTo( caretLeft + 20 - this.editor.offsetWidth, yPos );
    else this.editor.scrollTo( 0, yPos );
  }

  scrollToX () {
    const left = this.render.overflow.scrollLeft;
    const caretPos = this.caret.getPos();
    if ( this.render.overflow.offsetWidth + left - 10 - this.settings.left < caretPos.left ) {
      this.render.move.overflow(
        caretPos.left - (this.render.overflow.offsetWidth + left - 10 - this.settings.left),
        0
      );
    } else if ( caretPos.left < left + 10 + this.settings.left ) {
      this.render.move.overflow(
        -(left + 10  + this.settings.left - caretPos.left),
        0
       );
    }
  }

  set ( x, y ) {
    this.caret.el.style.left = x + 'px';
    this.caret.el.style.top  = y + 'px' ;
  }

  setByChar ( letter, line, el = null ) {
    if ( el ) this.pos.el = el;
    let posX = this.font.calculateWidth( this.pos.el.innerText.slice( 0, letter) );
    this.pos.letter = letter;
    this.pos.line   = line  ;

    this.caret.set(
      posX + this.settings.left + this.pos.el.offsetLeft,
      ( line * this.settings.line ) + this.settings.top
    );

    this.caret.scrollTo();
  }

  getPos () {
    return {
      top  : this.caret.el.style.top .replace('px',''),
      left : this.caret.el.style.left.replace('px',''),
    }
  }

  create ( parent ) {
    const caret = document.createElement("div");
    caret.className = 'caret';
    parent.insertBefore( caret, parent.children[0] );
    return caret;
  }

  hide () {
    if ( this.caret.el ) this.caret.el.style.display = "none";
    this.caret.isActive = false;
  }

  show () {
    if ( this.caret.el ) this.caret.el.style.display = "block";
    this.caret.isActive  = true;
  }

  refocus ( letter = this.pos.letter, line = this.pos.line, childIndex = this.pos.childIndex ) {
    this.pos.letter     = letter;
    this.pos.line       = line;
    this.pos.childIndex = childIndex;
    if ( !this.caret.isVisible() ) return;
    line = this.get.lineByPos( this.pos.line );
    if (
      this.pos.line <= this.render.hidden + this.render.linesLimit
      && this.pos.line >= this.render.hidden
      && line
    ) {
      this.pos.el = line.childNodes[ childIndex ];
      this.caret.setByChar(
        this.pos.letter,
        this.pos.line,
        line.childNodes[ this.pos.childIndex ]
      );
      return true;
    }
    return false;
  }
}
export { TabJF_Caret };