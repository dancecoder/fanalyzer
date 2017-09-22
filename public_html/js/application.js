/* global URL */

function Application() {
  this.context = null;  
  this.processing = null;
  this.currentAnalyticalData = null;
  this.windowResizeTimeout = null;
  this.outdataSelectTimeout = null;
}

Application.prototype.run = function() {
  this.processing = new Worker('js/ImageProcessingWorker.js');
  this.processing.addEventListener('message', this);
  this.processing.addEventListener('error', this);
  this.processing.postMessage({'action': 'noop'});
  document.addEventListener('DOMContentLoaded', function(){
    window.addEventListener('click', this);
    window.addEventListener('resize', this);
    window.addEventListener('change', this); // file input
    window.addEventListener('input', this);
  }.bind(this));  
};

Application.prototype.handleEvent = function(event) {
  var delegate;
  if (event.data) {
    var action = event.data.action;
    delegate = this[action];
  } else if (event.target && event.target.dataset && event.target.dataset.action) {
    var action = event.target.dataset.action;
    delegate = this[action];
  } else if (event.target === window && event.type === 'resize') {
    delegate = this.onWindowResize;
  }
  if (delegate) {
    var perevent = delegate.call(this, event);
    if (perevent === false) {
      event.preventDefault();
      event.stopPropagation();
    }
  } else {
    //console.warn('No action handler for ' + action + ' action');
  }
};

Application.prototype.onWindowResize = function(event) {
  window.clearTimeout(this.windowResizeTimeout);
  this.windowResizeTimeout = window.setTimeout(this.fitImage.bind(this), 200);
};

Application.prototype.clearElementAttributes = function(elt) {
  var id = elt.getAttribute('id');
  var attrs = elt.attributes;
  for(var i = attrs.length-1; i > -1; i--) {
    elt.removeAttribute(attrs[i].name);
  }
  elt.setAttribute('id', id);
};

Application.prototype.selectImageFile = function(event) {
  window.appFileInput.click();
  return false;
};

Application.prototype.loadImage = function(event) {
  if (event.type === 'change') {    
    var files = event.target.files;
    var file = files[0];
    event.target.value = '';
    if (file) {
      window.appImage.onload = function() {
        window.appImage.onload = undefined;        
        window.appCanvas.width = window.appImage.width;
        window.appCanvas.height = window.appImage.height;
        window.addDataOut.textContent = '';
        window.appAngle.value = 0;
        this.currentAnalyticalData = null;
        this.context = window.appCanvas.getContext('2d');        
        this.context.drawImage(window.appImage, 0, 0);
        this.fitImage();
        var imageData = this.context.getImageData(0, 0, window.appCanvas.width, window.appCanvas.height);
        this.processing.postMessage({ 'action': 'setImageData', 'imageData': imageData });        
      }.bind(this);
      var url = window.appImage.getAttribute('src');
      this.clearElementAttributes(window.appImage);      
      URL.revokeObjectURL(url);
      url = URL.createObjectURL(file);      
      window.appImage.setAttribute('src', url);
      this.clearElementAttributes(window.appGraphDataLayer);
      while (window.appGraphDataLayer.firstChild) {
        window.appGraphDataLayer.removeChild(window.appGraphDataLayer.firstChild);
      }
    }
  }
};


Application.prototype.updateImage = function(event) {
  var data = event.data.imageData;
  this.context.putImageData(data, 0, 0);
  window.appCanvas.toBlob(function(blob){
    var url = window.appImage.getAttribute('src');
    URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    window.appImage.setAttribute('src', url);
  }.bind(this), 'image/png', 1);
};

Application.prototype.updateHistogram = function(event) {
  var hg = event.data.histogram;
  var chart = window.appHistogram;
  while(chart.lastChild) {
    chart.removeChild(chart.lastChild);
  }  
  for (var i = 0; i < hg.data.length; i++) {
    var bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = Math.log(hg.data[i]) * 100 / Math.log(hg.max) + '%';
    window.appHistogram.appendChild(bar);
  }
};

Application.prototype.updateCenter = function(event) {
  var center = event.data.center;
  if (!window.appCenterPoint) {
    var cp = document.createElement('span');
    cp.classList.add('point');
    cp.classList.add('center');
    cp.setAttribute('id', 'appCenterPoint');
    window.appGraphDataLayer.appendChild(cp);
  }
  window.appCenterPoint.dataset.x = center.x;
  window.appCenterPoint.dataset.y = center.y;
  window.appImage.dataset.centerX = center.x;
  window.appImage.dataset.centerY = center.y;  
  this.fitImage();
};

Application.prototype.updateAxis = function(event) {
  var axisData = event.data.axis;
  this.currentAnalyticalData = new AnalyticalData();
  this.currentAnalyticalData.setAxisArray(axisData);
  this.updateDataLayer();
  this.fitImage();
};

Application.prototype.updateSymmetryAxis = function(event) {
  window.appAngle.value = 0;
  this.currentAnalyticalData.setSymmetryAxis(event.data.symmetryAxis);
  this.updateDataLayer();
  this.fitImage();
};


Application.prototype.showGauss = function(event) {
  if (this.context) {
    var imageData = this.context.createImageData(this.context.canvas.width, this.context.canvas.height);
    this.processing.postMessage({ 'action': 'applyGaussblur', 'imageData': imageData });
  }
};

Application.prototype.showGray = function(event) {
  if (this.context) {
    var imageData = this.context.createImageData(this.context.canvas.width, this.context.canvas.height);
    this.processing.postMessage({ 'action': 'applyGrayscale', 'imageData': imageData });
  }  
};

Application.prototype.showSobel = function(event) {
  if (this.context) {
    var imageData = this.context.createImageData(this.context.canvas.width, this.context.canvas.height);
    this.processing.postMessage({ 'action': 'applySobel', 'imageData': imageData });
  }
};

Application.prototype.showKanny = function(event) {
  if (this.context) {
    var imageData = this.context.createImageData(this.context.canvas.width, this.context.canvas.height);
    this.processing.postMessage({ 'action': 'applyKanny', 'imageData': imageData });
  }
};

Application.prototype.updateDataLayer = function() {
  if (this.currentAnalyticalData !== null) {
    for (var azimuth = 0; azimuth < 360; azimuth++) {
      var axis = this.currentAnalyticalData.getAxis(azimuth);
      var id = 'appBorderPoint' + azimuth;
      if (!window[id]) {
        var bp = document.createElement('span');
        bp.classList.add('point');
        bp.setAttribute('id', id);
        window.appGraphDataLayer.appendChild(bp);
      }
      window[id].dataset.x = axis.border.x;
      window[id].dataset.y = axis.border.y;
      window[id].dataset.azimuth = axis.azimuth;
      window[id].dataset.length = axis.length;
      window[id].classList.remove('symmetry')
    }
    var symmetryAxis = this.currentAnalyticalData.getSymmetryAxis();
    if (symmetryAxis !== null) {
      window.appGraphDataLayer.children[symmetryAxis + 1].classList.add('symmetry'); // first children is center point
      window.appImage.dataset.symmetryAxis = symmetryAxis;        
      window.addDataOut.textContent = this.currentAnalyticalData.exportToTSV();
      window.clearTimeout(this.outdataSelectTimeout);
      this.outdataSelectTimeout = window.setTimeout(window.addDataOut.select.bind(window.addDataOut), 500);
    }
  }
};

Application.prototype.fitImage = function() {

  var dWidth = window.appCanvas.width;
  var dHeight = window.appCanvas.height;
  var scale = 1;

  if (window.appFitImage.checked) {
    document.body.classList.add('fit');
    var style = getComputedStyle(document.body);
    var maxW = document.body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    var maxH = window.innerHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    scale = Math.min(maxW / dWidth , maxH / dHeight);    
    dWidth *= scale;
    dHeight *= scale;
  } else {
    document.body.classList.remove('fit');
  }

  window.appImage.width = dWidth;
  window.appImage.height = dHeight;
  window.appGraphDataLayer.style.width = window.appImage.width + 'px';
  window.appGraphDataLayer.style.height = window.appImage.height + 'px';
  window.appGraphDataLayer.style.top = window.appImage.offsetTop + 'px';
  window.appGraphDataLayer.style.left = window.appImage.offsetLeft + 'px';

  if (window.appCenterPoint) {    
    window.appCenterPoint.style.left = window.appCenterPoint.dataset.x * scale - 1 + 'px';
    window.appCenterPoint.style.top = window.appCenterPoint.dataset.y * scale - 1 + 'px';
  }

  for (var i = 0; i < 360; i++) {
    var id = 'appBorderPoint' + i;
    if (window[id]) {
      window[id].style.left = window[id].dataset.x * scale - 1 + 'px';
      window[id].style.top = window[id].dataset.y * scale - 1 + 'px';
    }
  }

  if (window.appImage.dataset.centerX !== undefined) {
    var torigin = window.appImage.dataset.centerX * scale + 'px ' + window.appImage.dataset.centerY * scale + 'px';
    window.appGraphDataLayer.style.transformOrigin = torigin;
    window.appImage.style.transformOrigin = torigin;
  }

  if (window.appImage.dataset.symmetryAxis !== undefined) {
    var transform = 'rotate(-' + window.appImage.dataset.symmetryAxis + 'deg)';
    window.appGraphDataLayer.style.transform = transform;
    window.appImage.style.transform = transform;
  }
  

};

Application.prototype.fitToggle = function(event) {
  if (event.type === 'change' && this.context) {
    this.fitImage();
  }  
};


Application.prototype.analyze = function(event) {
  if (this.context) {
    var imageData = this.context.createImageData(this.context.canvas.width, this.context.canvas.height);
    this.processing.postMessage({ 'action': 'analyze', 'imageData': imageData });
  }
};

Application.prototype.rotate = function(event) {
  if (event.type==='input' && this.currentAnalyticalData !== null) {
    this.currentAnalyticalData.adjustSymmetryAxis(parseInt(event.target.value));
    this.updateDataLayer();
    this.fitImage();
  }
};