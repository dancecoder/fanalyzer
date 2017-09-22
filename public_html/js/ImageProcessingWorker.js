/* global self, Statistics */

self.importScripts('Polyfill.js');
self.importScripts('ConvolutionKernels.js');
self.importScripts('ImageDataPixel.js');
self.importScripts('ImageDataWindow.js');
self.importScripts('Statistics.js');

function ImageProcessing() {
  this.imageData = null;
  this.grayData = null;
  this.kernels = new ConvolutionKernels();
  this.kernels.getGaussian(5, 1.4);
}

self.addEventListener('message', new ImageProcessing());

ImageProcessing.prototype.handleEvent = function(event) {  
  var action = event.data.action;
  if (action === undefined) {
    throw new Error('Message object must have the action field');
  }
  var delegat = this[action];
  if (delegat) {
    delegat.call(this, event);
  } else {
    throw new Error('Allegal argument, unknown action "' + action + '"');
  }
};

ImageProcessing.prototype.noop = function(event) {
  console.log('ImageProcessing.prototype.noop');
};

ImageProcessing.prototype.setImageData = function(event) {
  this.imageData = event.data.imageData;
  this.imageData.pixelSize = 4;
  var grayOperator = new GrayScaleOperator(this.imageData);
  this.iterate(this.imageData.width, this.imageData.height, 4, grayOperator);
  this.grayData = grayOperator.getResultData();
  this.normalize(this.grayData);
  var hg = this.histogram(this.grayData, 255);
  self.postMessage({ 'action': 'updateHistogram', 'histogram': hg });
};

ImageProcessing.prototype.applyGrayscale = function(event) {
  if (this.imageData) {
    var outImageData = event.data.imageData;
    var grayOperator = new GrayScaleOperator(this.imageData);
    this.iterate(this.imageData.width, this.imageData.height, 4, grayOperator);
    var grayData = grayOperator.getResultData();
    this.normalize(grayData);
    this.copyImageData(grayData, outImageData);
    self.postMessage({ 'action': 'updateImage', 'imageData': outImageData });
  } else {
    console.log('Please set image data first');
  }
};

ImageProcessing.prototype.applyGaussblur = function(event) {
  if (this.imageData) {
    var outImageData = event.data.imageData;
    var operator = new GaussianBlurOperator(this.imageData, 5, 1.4);
    var data = this.iterateXY(this.imageData.width, this.imageData.height, this.imageData.pixelSize, operator);
    this.apply(data, outImageData.data);
    self.postMessage({ 'action': 'updateImage', 'imageData': outImageData });
  } else {
    console.log('Please set image data first');
  }
};

ImageProcessing.prototype.applySobel = function(event) {
  if (this.imageData) {
    var outImageData = event.data.imageData;
    var operator = new SobelOperator(this.grayData);
    var data = this.iterateXY(this.grayData.width, this.grayData.height, this.grayData.pixelSize, operator);
    this.apply(data, outImageData.data);
    self.postMessage({ 'action': 'updateImage', 'imageData': outImageData });
  } else {
    console.log('Please set image data first');
  }
};

ImageProcessing.prototype.applyKanny = function(event) {
  if (this.imageData) {
    var outImageData = event.data.imageData;
    var blur = new GaussianBlurOperator(this.imageData, 5, 1.4);
    var data = this.iterateXY(this.grayData.width, this.grayData.height, this.grayData.pixelSize, blur);
    var sobel = new KannySobelOperator(data);
    data = this.iterateXY(this.grayData.width, this.grayData.height, this.grayData.pixelSize, sobel);
    var suppress = new KannyNonmaximumSuppress(data, sobel.directions);
    data = this.iterateXY(this.grayData.width, this.grayData.height, this.grayData.pixelSize, suppress);
    this.apply(data, outImageData.data);
    self.postMessage({ 'action': 'updateImage', 'imageData': outImageData });
  } else {
    console.log('Please set image data first');
  }
};


// TODO: remove this method, use normalize and copyData instead
ImageProcessing.prototype.apply = function(data, out) {
  for (var i = 0; i < data.stat.length; i++) {
    data.stat[i].weight = 255 / (data.stat[i].max - data.stat[i].min);
  }
  
  for (var i = 0, max = data.width * data.height; i < max; i++) {
    var offset = i * 4;
    for (var subpixel = 0; subpixel < data.pixelSize; subpixel++) {
      var rawValue = data.data[i*data.pixelSize+subpixel];
      var value = Math.round( (rawValue - data.stat[subpixel].min) * data.stat[subpixel].weight );
      out[offset+subpixel] = value;
    }
    if (data.pixelSize === 1) {
      out[offset+1] = out[offset];
      out[offset+2] = out[offset];
    }
    out[offset+3] = 255; // Alpha    
  }
  
};

ImageProcessing.prototype.normalize = function(data) {
  for (var i = 0; i < data.stat.length; i++) {
    data.stat[i].weight = 255 / (data.stat[i].max - data.stat[i].min);
  }
  for (var i = 0, max = data.width * data.height; i < max; i++) {
    for (var subpixel = 0; subpixel < data.pixelSize; subpixel++) {
      var index = i*data.pixelSize+subpixel;
      var rawValue = data.data[index];
      var value = Math.round( (rawValue - data.stat[subpixel].min) * data.stat[subpixel].weight );
      data.data[index] = value;
    }
  }
};

ImageProcessing.prototype.copyImageData = function(from, to) {
  for (var i = 0, max = from.width * from.height; i < max; i++) {
    var offset = i * 4;
    for (var subpixel = 0; subpixel < from.pixelSize; subpixel++) {      
      to.data[offset+subpixel] = from.data[i*from.pixelSize+subpixel];
    }
    if (from.pixelSize === 1) {
      to.data[offset+1] = to.data[offset];
      to.data[offset+2] = to.data[offset];
    }
    to.data[offset+3] = 255; // Alpha
  }
};

ImageProcessing.prototype.histogram = function(data, scale) {  
  var hgData = {
    max: 0,
    min: Number.MAX_VALUE,
    data: new Array(scale+1).fill(0)
  };  
  for (var i = 0, max = data.data.length; i < max; i++) {
    var index = Math.round(data.data[i]);
    var value = ++hgData.data[index];
    hgData.max = Math.max(hgData.max, value);
    hgData.min = Math.min(hgData.min, value);
  }
  return hgData;
};


ImageProcessing.prototype.iterateXY = function(width, height, pixelSize, operator) {
  var pxSize = pixelSize === 4 ? 3 : pixelSize;
  var out = {
    'pixelSize': pxSize,
    'width': width,
    'height': height,
    'data': new Array(width * height),
    'stat': new Array(pxSize)
  };
  out.stat.fill({ max: 0, min: Number.MAX_VALUE, count: 0});  
  var pixel = null;
  var dataCounter = 0;
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      for (var subpixel = 0; subpixel < pxSize; subpixel++) {
        pixel = operator.apply(x, y, subpixel);
        out.data[dataCounter++] = pixel;
        out.stat[subpixel].max = Math.max(out.stat[subpixel].max, pixel);
        out.stat[subpixel].min = Math.min(out.stat[subpixel].min, pixel);
      }
    }
  }
  return out;
};

ImageProcessing.prototype.iterateRecursive = function(startPixel, operator) {
  var stack = [];
  var x, y;
  var ivalue;
  for (var x = startPixel.x, y = startPixel.y, pixel = startPixel; x !== undefined && y !== undefined; y = stack.pop(), x = stack.pop()) {
    pixel.move(x, y);
    for (var subpixel = 0; subpixel < pixel.pixelSize; subpixel++) {
      ivalue = operator.apply(x, y, subpixel);
      if (ivalue !== null) {
        pixel.set(subpixel, ivalue);
      }
    }
    if (ivalue !== null) {
      if (x+1 < pixel.width) {
        stack.push(x+1, y);
      }
      if (x-1 > -1) {
        stack.push(x-1, y);
      }
      if (y+1 < pixel.height) {
        stack.push(x, y+1);
      }
      if (y-1 > -1) {
        stack.push(x, y-1);
      }
    }
  }
  return startPixel;
};

ImageProcessing.prototype.iterate = function(width, height, pixelSize, operator) {
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      for (var subpixel = 0; subpixel < pixelSize; subpixel++) {
        var value = operator.apply(x, y, subpixel);
      }
    }
  }
};

ImageProcessing.prototype.iteratePolarAxis = function(center, azimuth, pixelSize, operator) {
  var radAzimuth = azimuth * (Math.PI / 180);
  var cosAzimuth = Math.cos(radAzimuth) * -1;
  var sinAzimuth = Math.sin(radAzimuth);
  var r = 0.5;
  var gonext = true;
  while (gonext) {
    //var x = Math.round(r * cosAzimuth) + center.x;
    //var y = Math.round(r * sinAzimuth) + center.y;
    var x = Math.round(r * sinAzimuth) + center.x;
    var y = Math.round(r * cosAzimuth) + center.y;
    for (var subpixel = 0; subpixel < pixelSize; subpixel++) {
      gonext &= operator.apply(x, y, subpixel);
    }
    r += 0.5;
  }
};


ImageProcessing.prototype.analyze = function(event) {
if (this.imageData) {
    var outImageData = event.data.imageData;
    var backgroundColor = [255];
    
    var sobelOperator = new SobelOperator(this.grayData);
    var data = this.iterateXY(this.grayData.width, this.grayData.height, this.grayData.pixelSize, sobelOperator);
    this.normalize(data);

    var fillOperator = new ThresholdFillOperator(data, [16], backgroundColor);
    var pixelData = new ImageDataPixel(data);    
    pixelData = this.iterateRecursive(pixelData, fillOperator);
    this.copyImageData(data, outImageData);
    self.postMessage({ 'action': 'updateImage', 'imageData': outImageData });

    var centerOperator = new FindCenterOperator(data, backgroundColor);
    this.iterate(data.width, data.height, data.pixelSize, centerOperator);
    var center = centerOperator.getCenter()[0];
    self.postMessage({ 'action': 'updateCenter', 'center': center });

    var axis = new Array(360);
    var axisOperator = new FindAxisLengthOperator(data, backgroundColor);
    for(var azimuth = 0; azimuth < 360; azimuth++) {
      this.iteratePolarAxis(center, azimuth, data.pixelSize, axisOperator);
      axis[azimuth] = {
        'azimuth': azimuth,
        'border': axisOperator.b[0],
        'length': axisOperator.getLength()[0]
      };
      axisOperator.reset();
    }
    self.postMessage({ 'action': 'updateAxis', 'axis': axis });

    for(var azimuth = 0; azimuth < 180; azimuth++) {
      var currentAxis = axis[azimuth];
      var left = [];
      var right = [];
      for (var i = 1; i < 180; i++) {
        var r = azimuth + i;
        var l = azimuth - i;
        if (r > 360) r = r - 360;
        if (l < 0) l = l + 360;        
        left.push(axis[l].length);
        right.push(axis[r].length);        
      }
      currentAxis.symmetryFactor = Statistics.covariance(left, right);
    }
    var symmetryAxis = 0;
    for(var azimuth = 1; azimuth < 180; azimuth++) {
      if (axis[symmetryAxis].symmetryFactor < axis[azimuth].symmetryFactor) {
        symmetryAxis = azimuth;
      }
    }
    self.postMessage({ 'action': 'updateSymmetryAxis', 'symmetryAxis': symmetryAxis });
  } else {
    console.log('Please set image data first');
  }
};


function GrayScaleOperator(imageData) {
  this.data = imageData;
  this.pixel = new ImageDataPixel(imageData);
  this.gray = new Uint16Array(imageData.width * imageData.height);
  this.bg = [255, 255, 255];
  this.dataCounter = 0;
  this.max = 0;
  this.min = Number.MAX_VALUE;
}

GrayScaleOperator.prototype.apply = function(x, y, subpixel) {
  if (subpixel === 0) {
    this.pixel.move(x, y);
    var a = this.pixel.get(3) / 255;
    var value = 
        this.bg[0] * (1-a) + this.pixel.get(0) * a + // r
        this.bg[1] * (1-a) + this.pixel.get(1) * a + // g
        this.bg[2] * (1-a) + this.pixel.get(2) * a ; // b
    this.gray[this.dataCounter++] = value;
    this.max = Math.max(this.max, value);
    this.min = Math.min(this.min, value);
  }
};

GrayScaleOperator.prototype.getResultData = function() {
  return {
    pixelSize: 1,
    width: this.data.width,
    height: this.data.height,
    data: this.gray,
    stat: [{
      max: this.max,
      min: this.min
    }]
  };
};

function FindAxisLengthOperator(imageData, backgroundColor) {
  this.pixel = new ImageDataPixel(imageData);
  this.stop = backgroundColor;
  this.a = new Array(imageData.pixelSize);
  this.b = new Array(imageData.pixelSize);
};

FindAxisLengthOperator.prototype.apply = function(x, y, subpixel) {
  this.pixel.move(x, y);
  var pixelColor = this.pixel.get(subpixel);
  if (pixelColor === this.stop[subpixel]) {
    if (!this.b[subpixel]) {
      this.b[subpixel] = { 'x': x, 'y': y };
    }
    return false;
  } else {
    if (!this.a[subpixel]) {
      this.a[subpixel] = { 'x': x, 'y': y };
    }
    return true;
  }
};

FindAxisLengthOperator.prototype.getLength = function() {
  var lengths = new Array(this.pixel.pixelSize);
  for (var subpixel = 0; subpixel < this.pixel.pixelSize; subpixel++) {
    lengths[subpixel] = Math.sqrt(
        Math.pow(this.a[subpixel].x - this.b[subpixel].x, 2) +
        Math.pow(this.a[subpixel].y - this.b[subpixel].y, 2)
    );
  }
  return lengths;
};

FindAxisLengthOperator.prototype.reset = function() {
  this.a = new Array(this.pixel.pixelSize);
  this.b = new Array(this.pixel.pixelSize);
};


function FindCenterOperator(imageData, backgroundColor) {
  this.pixel = new ImageDataPixel(imageData);
  this.exclude = backgroundColor;
  this.count = new Array(imageData.pixelSize);
  this.count.fill(0);
  this.xx = new Array(imageData.pixelSize);
  this.xx.fill(0);
  this.yy = new Array(imageData.pixelSize);
  this.yy.fill(0);
};

FindCenterOperator.prototype.apply = function(x, y, subpixel) {
  this.pixel.move(x, y);
  if (this.pixel.get(subpixel) !== this.exclude[subpixel]) {
    this.count[subpixel]++;
    this.xx[subpixel] += x;
    this.yy[subpixel] += y;
  }
};

FindCenterOperator.prototype.getCenter = function() {
  var centers = new Array(this.pixel.pixelSize);
  for (var i = 0; i < this.pixel.pixelSize; i++) {
    centers[i] = {
      x: Math.round(this.xx[i] / this.count[i]),
      y: Math.round(this.yy[i] / this.count[i])
    };
  }
  return centers;
};


function ThresholdFillOperator(imageData, maxColor, targetColor) {
  this.max = maxColor;
  this.target = targetColor;
  this.pixel = new ImageDataPixel(imageData);
};

ThresholdFillOperator.prototype.apply = function(x, y, subpixel) {
  this.pixel.move(x, y);
  var current = this.pixel.get(subpixel);
  if (current < this.max[subpixel] && current !== this.target[subpixel]) {
    return this.target[subpixel];
  }
  return null;
};


function FillOperator(imageData, originalColor, targetColor) {
  this.original = originalColor;
  this.target = targetColor;
  this.pixel = new ImageDataPixel(imageData);
};

FillOperator.prototype.apply = function(x, y, subpixel) {
  this.pixel.move(x, y);
  var current = this.pixel.get(subpixel);
  if (current === this.original[subpixel]) {
    return this.target[subpixel];
  }
  return null;
};


function GaussianBlurOperator(imageData, size, sigma) {
  var kernels = new ConvolutionKernels();
  this.kernel = kernels.getGaussian(size, sigma);  
  this.win = new ImageDataWindow(imageData, size);
}

GaussianBlurOperator.prototype.apply = function(x, y, subpixel) {
  this.win.move(x, y);
  return this.win.convolution(this.kernel, subpixel);
};


function SobelOperator(imageData) {
  var kernels = new ConvolutionKernels();
  this.kernelX = kernels.sobelX;
  this.kernelY = kernels.sobelY;
  this.win = new ImageDataWindow(imageData, 3);
};

SobelOperator.prototype.apply = function(x, y, subpixel) {
  this.win.move(x, y);
  var Gx = this.win.convolution(this.kernelX, subpixel);
  var Gy = this.win.convolution(this.kernelY, subpixel);
  return Math.hypot(Gx, Gy);
  //return Math.sqrt(Math.pow(Gx, 2) + Math.pow(Gy, 2));
};


function KannySobelOperator(imageData) {  
  var kernels = new ConvolutionKernels();
  this.kernelX = kernels.sobelX;
  this.kernelY = kernels.sobelY;
  this.win = new ImageDataWindow(imageData, 3);
  this.directions = new Uint8Array(imageData.width * imageData.height);
  this.bounds = [
    22.5 * Math.PI / 180,
    67.5 * Math.PI / 180,
    92.5 * Math.PI / 180,
    137.5 * Math.PI / 180
  ];
};

KannySobelOperator.prototype.apply = function(x, y, subpixel) {
  this.win.move(x, y);
  var Gx = this.win.convolution(this.kernelX, subpixel);
  var Gy = this.win.convolution(this.kernelY, subpixel);
  this.directions[this.win.pixel.i] = this.getDirection(Gx, Gy);
  return Math.hypot(Gx, Gy);
};

KannySobelOperator.prototype.getDirection = function(Gx, Gy) {
  var angle = Math.atan2(Gy, Gx);
  if (angle >= 0 && angle < this.bounds[0]) {
    return 0;
  } else if (angle >= this.bounds[0] && angle < this.bounds[1]) {
    return 1;
  } else if (angle >= this.bounds[1] && angle < this.bounds[2]) {
    return 2;
  } else if (angle >= this.bounds[2] && angle < this.bounds[3]) {
    return 3;
  } else if (angle >= this.bounds[3]) {
    return 0;
  }
};


function KannyNonmaximumSuppress(imageData, directions) {
  this.pixel = new ImageDataPixel(imageData);
  this.directions = directions;
  this.offsets = [
    [[+1,  0], [-1,  0]],
    [[+1, +1], [-1, -1]],
    [[ 0, +1], [ 0, -1]],
    [[-1, +1], [+1, -1]]
  ];
};

KannyNonmaximumSuppress.prototype.apply = function(x, y) {
  this.pixel.move(x, y);
  var direction = this.directions[this.pixel.getOffset(0)];
  var p = this.pixel.get(0);
  if (p > 0) {
    var offset = this.offsets[direction];
    for (var i = 0; i < 2; i++) {
      if (p < this.pixel.get(0,  offset[i][0], offset[i][1])) {
        return 0;
      }
    }
  }
  return p;
};