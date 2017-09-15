function ImageDataPixel(imageData) {
  this.pixelSize = imageData.pixelSize;
  this.width = imageData.width;
  this.height = imageData.height;
  this.maxY = imageData.height - 1;
  this.maxX = imageData.width - 1;
  this.array = imageData.data;
  this.x = 0;
  this.y = 0;
  this.i = 0;
}

ImageDataPixel.prototype.getIndex = function(x, y) {
  var clampY = Math.min(Math.max(y, 0), this.maxY);
  var clampX = Math.min(Math.max(x, 0), this.maxX);
  return clampY * this.width + clampX;
};

ImageDataPixel.prototype.move = function(x, y) {
  this.x = x;
  this.y = y;
  this.i = this.getIndex(x, y);
};

ImageDataPixel.prototype.getOffset = function(subpixel) {
  return this.i * this.pixelSize + subpixel;
};

ImageDataPixel.prototype.get = function(subpixel, dx, dy) {
  if (dx === undefined) {
    return this.array[this.getOffset(subpixel)];
  } else {
    var idx = this.getIndex(this.x + dx, this.y + dy);
    return this.array[idx * this.pixelSize + subpixel];
  }
};

ImageDataPixel.prototype.set = function(subpixel, value) {
  this.array[this.getOffset(subpixel)] = value;
};