function ImageDataWindow(imageData, size) {  
  this.array = imageData.data;
  this.radius = (size - 1) / 2;
  this.pos = new Array(size*size);
  this.pixel = new ImageDataPixel(imageData);
}

ImageDataWindow.prototype.move = function(x, y) {
  var j = 0;
  for (var dy = 0 - this.radius; dy <= this.radius; dy++) {
    for (var dx = 0 - this.radius; dx <= this.radius; dx++) {
      this.pixel.move(x + dx, y + dy);
      this.pos[j++] = this.pixel.getOffset(0);
    }
  }
  this.pixel.move(x, y);
};

ImageDataWindow.prototype.getOffset = function(j) {
  return this.pos[j];
};

ImageDataWindow.prototype.convolution = function(kernel, subpixel, div, offset) {
  var G = 0;
  for (var i = 0, max = kernel.length; i < max; i++) {
    G += (this.array[this.getOffset(i) + subpixel]) * kernel[i];
  }
  if (div !== undefined) {
    if (div === 0) {
      throw new Error("Divider cannot be zero");
    }
    G /= div;
  }
  if (offset !== undefined) {
    G -= offset;
  }
  return G;
};