import functions from '../../../functions/css.js';
let doubleQuote;export default doubleQuote = {
  attrs : {
    style : 'color:#0F0;'
  },
  triggers : {
    line : {
      start : functions.line.start
    }
  },
  end : '"',
  subset : {
    sets : {
      ' ' : {
        single : true,
        attrs : {
          class : 'spaces'
        }
      },
      default : {
        attrs : {
          style : 'color:#0F0;'
        }
      }
    }
  }
};
