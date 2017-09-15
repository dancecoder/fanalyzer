/* global Infinity, HTMLCanvasElement */


/* MDN Array.fill() polyfill (see: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill) */
if (!Array.prototype.fill) {
  Array.prototype.fill = function(value) {
    if (this == null) {
      throw new TypeError('this is null or not defined');
    }
    var O = Object(this);
    var len = O.length >>> 0;
    var start = arguments[1];
    var relativeStart = start >> 0;
    var k = relativeStart < 0 ? Math.max(len + relativeStart, 0) : Math.min(relativeStart, len);
    var end = arguments[2];
    var relativeEnd = end === undefined ? len : end >> 0;
    var final = relativeEnd < 0 ? Math.max(len + relativeEnd, 0) : Math.min(relativeEnd, len);
    while (k < final) {
      O[k] = value;
      k++;
    }
    return O;
  };
}


/* (see: https://bugzilla.mozilla.org/show_bug.cgi?id=896264#c28) */
Math.hypot = Math.hypot || function (x, y) {
  var max = 0;
  var s = 0;
  for (var i = 0; i < arguments.length; i += 1) {
    var arg = Math.abs(Number(arguments[i]));
    if (arg > max) {
      s *= (max / arg) * (max / arg);
      max = arg;
    }
    s += max > 0 ? (arg / max) * (arg / max) : 0;
  }
  return max === Infinity ? Infinity : max * Math.sqrt(s);
};

/* (see: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) */
if (typeof HTMLCanvasElement === "object" && !HTMLCanvasElement.prototype.toBlob) {
 Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
  value: (HTMLCanvasElement.prototype.msToBlob ?
      HTMLCanvasElement.prototype.toBlob :
      function (callback, type, quality) {
        var binStr = atob( this.toDataURL(type, quality).split(',')[1] );
        var len = binStr.length;
        var  arr = new Uint8Array(len);
        for (var i = 0; i < len; i++ ) {
          arr[i] = binStr.charCodeAt(i);
        }
        callback( new Blob( [arr], { 'type': type || 'image/png' } ) );
      })
 });
}