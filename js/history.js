

function setVisibility(id, visibility) {
				document.getElementById(id).style.display = visibility;
			}

var width,
    height,
    camera,
    webglScene,
    renderer,
    frameCount = 0,
    impressions,
    atlas,
    grid,
    timelineTicks,
    timeline,
    filters,
    keywords,
    focusImpression,
    loader,
    counters,
    optIn = true,
    colorThief,
    globalActive = true,
    personalDataMenu
    verbose = false;

document.addEventListener("DOMContentLoaded", setup, false);

function setup() {

    if(!detectWebglSupport()){
        d3.select('#container').append('p')
            .html('Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">WebGL</a>.<br/>Find out how to get it <a href="http://get.webgl.org/">here</a>.')
            .classed('errorMessage',true)
            .style('opacity',0)
            .transition()
            .style('opacity',1)
        return;
    }

    setSceneSize();

    renderer = new THREE.WebGLRenderer({alpha:true,antialias:true});
    renderer.setSize(width, height);
    document.getElementById('container').appendChild(renderer.domElement);

    webglScene = new THREE.Scene();

    setCamera();
    webglScene.add(camera);

    colorThief = new ColorThief();

    d3.select(window).on('focus',function() {globalActive = true});
    d3.select(window).on('blur',function() {globalActive = false});

    chrome.extension.sendMessage( { "whatKind":"checkOptIn"}, function(response, error){
        
        if(error) {
            displayError('checkOptIn',error);
            return;
        }
        optIn = response.status;
        if (verbose) console.log("optIn status: " + optIn);
        // personalDataMenu = new DropdownMenu().init();
        if(!optIn) personalDataMenu = new DropdownMenu().init();
        // else {

        // }

        setLayoutInteractions();
        setAboutInteractions();
        setNavInteractions();

        chrome.extension.sendMessage({"whatKind":"retrieveImpressions"}, function(response, error){
            if(error) {
                displayError('retrieveImpressions',error);
                return;
            }
            initHistory(response);
        });

    });

    //css loading indicator
    loader = new AdLoader();
    loader.init();   

}

var update = function update(){

    if(impressions.loading) {
        impressions.loadImages();
    }

    if(globalActive){
        frameCount ++;
        grid.update();
        renderer.render(webglScene, camera);  
    }
    requestAnimationFrame(update);

}

function initHistory(historyResponse){
    impressions = new ImpressionManager(historyResponse);
    timeline = new Timeline();
    timeline.init();
    filters = new FilterManager();
    impressions.init();
    grid = new AdLayout();
    atlas = new AdAtlas();
    atlas.addTexture();
    keywords = new KeywordTree();
    counters = new AdCounters();
    counters.init();
    timelineTicks = new TimelineTicks();
    setInteractions();
    update();
}

function checkForHover(mouse){
    var len = impressions.loadedPool.length;
    var lastFocusImpression = focusImpression;
    focusImpression = null;
    for(var i = 0; i<len; i++){
        var imp = impressions.loadedPool[i];
        if((imp.filtered && !imp.removed) && imp.tpos){
            if(mouse[0]>=imp.tpos.x+grid.tpos.x && mouse[0]<imp.tpos.x+(grid.viewMode == 0 ? imp.placement.width : 10)+grid.tpos.x){
                if(mouse[1]>=imp.tpos.y+grid.tpos.y && mouse[1]<imp.tpos.y+(grid.viewMode == 0 ? imp.placement.height : 10)+grid.tpos.y){
                    focusImpression = imp;
                    d3.select('#container canvas').style('cursor','pointer');
                    break;
                }
            }
        }
    }
    if(!focusImpression) d3.select('#container canvas').style('cursor','auto');
}

function clearInteractions(){
    d3.select('#container canvas')
        .on('click',null)
        .on('mousemove',null)
    d3.select('#container')
        .on('mousewheel',null);
}

function setLayoutInteractions(){

    d3.selectAll('#header, div.hitbox1, div.hitbox2')
        .on('mousewheel',function(){
            d3.selectAll('#header, div.hitbox1, div.hitbox2')
                .on('mousewheel',null)
            d3.select('#header')
                    .transition()
                    .style('height',d3.event.wheelDeltaY < 0 ? '5px' : '100px')
                    .each('end', setLayoutInteractions)

            d3.select('#header div.wrap div.logo img')
                    .transition()
                    // .style('top',d3.event.wheelDeltaY < 0 ? '5px' : '0px')
                    .style('bottom',d3.event.wheelDeltaY < 0 ? '19px' : '0px')
                    .each('end', setLayoutInteractions)

            d3.selectAll('h1, div.nav')
                    .transition()
                    .style('opacity',d3.event.wheelDeltaY < 0 ? 0 : 1)

            // d3.select('#filters div.counters')
            //     .transition()
            //     .style('margin-top',d3.event.wheelDeltaY < 0 ? '72px' : '72px')
        })
}


function setAboutInteractions(){

    d3.selectAll('.sharingOptions div').classed('enabled', function(d,i){return optIn ? i%2==0 : i%2==1})

    d3.selectAll('.sharingOptions div')
        .on('click',function(d,i){
            chrome.extension.sendMessage( { "whatKind":"setOptIn", "optIn": i%2 == 0 }, function(status, error){

                if(error) {
                    displayError('setOptIn',error);
                    return;
                }

                d3.selectAll('.sharingOptions div').each(function(_d,_i){
                    d3.select(this).classed('enabled',i%2 == _i%2);
                });

                d3.select('p.confirmation').remove();
                d3.selectAll('.sharingOptions').append('p')
                    .classed('confirmation',true)
                    .text(i%2==0 ? 'Thanks for choosing to submit your data!' : "Your data won't be stored on our servers.")
                    .style('opacity',0)
                    .style('color','#7fbfff')
                    .transition()
                    .style('opacity',1)
                    .transition()
                    .delay(2000)
                    .style('opacity',0)
                    .each('end',function(){
                        d3.select(this).remove()
                        if(i%2 == 0 && personalDataMenu) personalDataMenu.remove();
                    })

            })

        })
}



function setNavInteractions(){
    d3.selectAll('div.nav div')
        .on('click',function(){
            if(d3.select(this).text() == 'About' && !d3.select(this).classed('current')){
                // if(d3.selectAll('div.nav div:nth-child(2)').classed('current')){
                //     toggleSignature(false,this);
                // }
                toggleAbout(true,this);

                d3.selectAll('div.nav div').classed('current',false)
                d3.select(this).classed('current',true);
            } else if(d3.select(this).text() == 'History' || d3.select(this).classed('current')){
                // if(d3.selectAll('div.nav div:nth-child(2)').classed('current')){
                //     toggleSignature(false,this);
                // }
                toggleAbout(false,this);

                d3.selectAll('div.nav div').classed('current',false)
                d3.select('div.nav div:first-child').classed('current',true);
            } 
            // else if(d3.select(this).text() == 'Signature' || d3.select(this).classed('current')){
            //     if(d3.selectAll('div.nav div:last-child').classed('current')){
            //         toggleAbout(false,this);
            //     }
            //     toggleSignature(true,this);

            //     d3.selectAll('div.nav div').classed('current',false)
            //     d3.select('div.nav div:nth-child(2)').classed('current',true);
            // }
        })
}

function toggleAbout(active, target){
    if(active){
        var globalHeight = window.getComputedStyle(document.getElementById('mainWrapper')).height.split("px")[0];
        d3.select('#mainWrapper')
            .transition()
            .duration(400)
            .style('margin-top',(globalHeight-100)+'px');
        d3.select('#about')
            .transition()
            .duration(400)
            .style('height',(globalHeight-100)+'px');
        d3.selectAll('#header, div.hitbox1, div.hitbox2')
                .on('mousewheel',null)
        d3.select('#header')
                .transition()
                .style('height','100px')
        d3.selectAll('h1, div.nav')
                    .transition()
                    .style('opacity',d3.event.wheelDeltaY < 0 ? 0 : 1)
    } else {
        d3.select('#mainWrapper')
            .transition()
            .duration(400)
            .style('margin-top','0px');
        d3.select('#about')
            .transition()
            .duration(400)
            .style('height','0px');
        setLayoutInteractions();
    }
}

function toggleSignature(active, target){
    // if(active){
    //     d3.select('#filters')
    //         .style('pointer-events','none')
    //         .style('position','absolute')
    //         .transition()
    //         .style('opacity',0)
    //     d3.select('#demographics')
    //         .style('position','relative')
    //         .style('display','block')
    //         .transition()
    //         .style('opacity',1)

    //     d3.select('#containerWrapper')
    //         .style('pointer-events','none')
    //         .style('position','absolute')
    //         .transition()
    //         .style('opacity',0)
    //     d3.select('#p5')
    //         .style('position','relative')
    //         .style('display','block')
    //         .transition()
    //         .style('opacity',1)

    // } else {
    //     d3.select('#filters')
    //         .style('pointer-events','auto')
    //         .transition()
    //         .style('opacity',1)
    //     d3.select('#demographics')
    //         .transition()
    //         .style('opacity',0)
    //         .each('end',function(){
    //             d3.select(this)
    //                 .style('display','none');
    //             d3.select('#filters')
    //                 .style('position','relative')
    //         })

    //     d3.select('#containerWrapper')
    //         .style('pointer-events','auto')
    //         .transition()
    //         .style('opacity',1)
    //     d3.select('#p5')
    //         .transition()
    //         .style('opacity',0)
    //         .each('end',function(){
    //             d3.select(this)
    //                 .style('display','none');
    //             d3.select('#containerWrapper')
    //                 .style('position','relative')
    //         })
    // }
}

function scrollBehavior(){
    if(grid){
        if(grid.viewMode == 0) {
            var delta = event.wheelDelta;
            // var d = ((-Math.max.apply(null, grid.colYs) + height*0.5) - grid.tpos.y);
            // if(d>0) delta /= map(d,0,height/2,1,50);

            var lastPos = grid.tpos.y;
            grid.tpos.y = constrain(grid.tpos.y + delta,-Math.max.apply(null, grid.colYs) + height*0.5,0);
            delta = grid.tpos.y - lastPos;

            if(loader){
                if(loader.movedToBottom){
                    loader.tpos.y += delta;
                }
            }
        }
        if(grid.viewMode == 1) {
            grid.tpos.x = constrain(grid.tpos.x + event.wheelDelta,5,Math.max(0,(grid.colXs+2)*9-width));
        }
    }
}

function setInteractions(){

    clearInteractions();
    d3.select('#container canvas')
        .on('click',function(){
            if(focusImpression) focusImpression.focus();
        })
        .on('mousemove',function(){
            checkForHover(d3.mouse(this));
        })

    d3.select('#container')
        .on('mousewheel',scrollBehavior);
}


function setSceneSize(){
    width = window.getComputedStyle(document.getElementById('container')).width.split("px")[0];
    height = window.getComputedStyle(document.getElementById('container')).height.split("px")[0];
    if(renderer) {
        renderer.setSize(width, height);
        setCamera();
    }
}


function setCamera(){
    camera = new THREE.PerspectiveCamera( 45, width / height, 1, 1000 );
    var cameraZ = ((height/2.0) / Math.tan(Math.PI*60.0/360.0));
    camera.fov = 60;
    camera.aspect = width / height;
    camera.near = cameraZ/10;
    camera.far = cameraZ*100;
    camera.position.x = width/2;
    camera.position.y = height/2;
    camera.position.z = -cameraZ;
    camera.up.set( 0, -1, 0 );
    camera.lookAt(new THREE.Vector3( width/2, height/2, 0 ));
    camera.updateProjectionMatrix();
}

function displayError(source, error){

    if(loader.running) loader.remove();
    if(source != 'setOptIn'){
        d3.select('#errorDisplay')
            .style('display','block')
            .transition()
            .style('opacity',1)
    }

    var fatal = false;

    if(error == 'SERVICE_UNAVAILABLE'){
        d3.select('#errorDisplay p').text("The Floodwatch server is down for maintenance. Please check back later, and we're sorry for the inconvenience.");
        fatal = true;
    } else if(source == 'checkOptIn') {
        if(!error) d3.select('#errorDisplay p').text("It seems you are offline. Please check your connection and try again.");
        else d3.select('#errorDisplay p').text("We can't retrieve your account information. Please try again, or contact floodwatch@o-c-r.org to file a bug report.");
        fatal = false;
    } else if(source == 'setOptIn') {
        d3.selectAll('.sharingOptions').append('p')
            .classed('confirmation',true)
            .text("We couldn't register your changes. Please try again, or contact floodwatch@o-c-r.org to file a bug report.")
            .style('opacity',0)
            .style('color','#7fbfff')
            .transition()
            .style('opacity',1)
            .transition()
            .delay(3000)
            .style('opacity',0)
            .each('end',function(){d3.select(this).remove()})
        fatal = false;
    } else if(source == 'retrieveImpressions') {
        d3.select('#errorDisplay p').text("We ran into an error retrieveing your ad impressions. Please try again, or contact floodwatch@o-c-r.org to file a bug report.");
        fatal = true;
    } else if(source == 'retrievePlacements') {
        d3.select('#errorDisplay p').text("We ran into an error retrieveing your ad placements. Please try again, or contact floodwatch@o-c-r.org to file a bug report.");
        fatal = true;
    } else if(source == 'impressionManager') {
        d3.select('#errorDisplay p').text("We ran into an error retrieveing your ad placements. Please try again, or contact floodwatch@o-c-r.org to file a bug report.");
        impressions.loading = false;
        fatal = true;
    } else if(source == 'flagAd') {
        d3.select('#errorDisplay p').text("We couldn't register your changes. Please try again, or contact floodwatch@o-c-r.org to file a bug report.");
        fatal = false;    
    } else if(source == 'flagAdFromModule') {
        d3.select('#errorDisplay p').text("We couldn't register your changes. Please try again, or contact floodwatch@o-c-r.org to file a bug report.");
        d3.select('#taggingBody')
            .transition()
            .style('opacity',0)
            .each('end',function(){
                d3.select(this).style('display','none')
            })
        fatal = false;
    } else if(source == 'tagPlacement') {
        d3.select('#errorDisplay p').text("We couldn't register your changes. Please try again, or contact floodwatch@o-c-r.org to file a bug report.");
        d3.select('#taggingBody')
            .transition()
            .style('opacity',0)
            .each('end',function(){
                d3.select(this).style('display','none')
            })
        fatal = false;
    }

    if(!fatal){
        d3.select('#errorDisplay div.resume')
            .style('display','block')
            .on('click',function(){
                d3.select(this)
                    .style('display','none');
                d3.select('#errorDisplay')
                    .transition()
                    .style('opacity',0)
                    .each('end',function(){
                        d3.select(this)
                            .style('display','block');
                    });
            });
    } else {
        d3.selectAll('#container *:not(#errorDisplay), #filters *')
            .style('pointer-events','none');
    }

}

function detectWebglSupport(){
    try { 
        var canvas = document.createElement( 'canvas' ); 
        return !! window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ); 
    } catch( e ) { 
        return false; 
    } 
}

function map(value, start1, stop1, start2, stop2) {
    return parseFloat(start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1)));
}

function clamp(val, range) {
    return Math.min(Math.max(val, range[0]), range[1]);
}


function random(min, max){
    return min + Math.random()*(max-min);
}

function lerp(start, stop, amt) {
    return start + (stop-start) * amt;
}

THREE.Vector3.prototype.lerp = function(target,progress){
    this.x = lerp(this.x,target.x,progress);
    this.y = lerp(this.y,target.y,progress);
    this.z = lerp(this.z,target.z,progress);
}

function constrain(number, min, max){
    return Math.min(Math.max(parseInt(number), min), max);
}


ImpressionManager = function(historyResponse){
    
    this.all = [];
    this.loadedPool = [];
    this.lastImpressionCount = 0;
    this.lastPlacementCount = 0;
    this.loading = true;    
    this.colorPalette = [new THREE.Vector3(1,0.74,0.53),
                    new THREE.Vector3(0,0.74,0.53),
                    new THREE.Vector3(0.08,0.82,0.48),
                    new THREE.Vector3(0.15,0.85,0.49),
                    new THREE.Vector3(0.23,0.75,0.5),
                    new THREE.Vector3(0.3,0.8,0.52),
                    new THREE.Vector3(0.38,0.74,0.53),
                    new THREE.Vector3(0.45,0.75,0.5),
                    new THREE.Vector3(0.53,0.75,0.5),
                    new THREE.Vector3(0.6,0.75,0.5),
                    new THREE.Vector3(0.68,0.75,0.52),
                    new THREE.Vector3(0.75,0.75,0.5),
                    new THREE.Vector3(0.82,0.75,0.5),
                    new THREE.Vector3(0.9,0.75,0.5),
                    new THREE.Vector3(0.62,0.1,0.6),
                    new THREE.Vector3(0.61,0.1,0.04),
                    new THREE.Vector3(0,0.1,1)
                    ];

    this.timeRange = [10000000000, 0];
    var len = Math.round(historyResponse.items.length);
    for(var i = len-1; i>=0; i--){
        // for(var j=0; j< 10; j++){
            var a = new AdImpression(historyResponse.items[i]);
            this.all.push(a);
            if(a.timestamp < this.timeRange[0]) this.timeRange[0] = a.timestamp;
            if(a.timestamp > this.timeRange[1]) this.timeRange[1] = a.timestamp;
        // }
    }

    if(this.timeRange[1]-this.timeRange[0] < 1) this.timeRange[0]--;

    this.loadedTimeRange = [this.timeRange[1], this.timeRange[1]];

    this.poolSize = 20;
    this.countBeforeUpdatingGrid = this.poolSize;

    this.errorCount = 0;

    this.placementPagesLoaded = 0;
    this.placements = []; 
    this.placementLoadingQueue = [];
    this.placementLoadingPool = [];
    this.placementLoadedPool = [];
    this.loadPlacements();
    this.placementLoading = true;
    this.lastShaderUpdate = 0;

    this.impressionStep = 500;
    this.impressionStepCounter = this.impressionStep;
    this.firstLoad = true;

}

ImpressionManager.prototype = {

    constructor: ImpressionManager,

    init: function(){

        this.loading = true;

    },


    loadPlacements: function(){

        // console.log(frameCount, 'aga');
        var _this = this;
        var loadNextPage = function(){
            // if(_this.placementLoadingPool.length < _this.poolSize && globalActive && _this.loading){

            if(!_this.loading) return;
            if(_this.placementLoadingPool.length < _this.poolSize){
                // console.log(frameCount + ' load next page: ' + (_this.placementPagesLoaded+1));
                chrome.extension.sendMessage({"whatKind":"retrievePlacements","page":(_this.placementPagesLoaded+1),"num":_this.poolSize}, function(placementResponse, error){

                    if(error) {
                        // displayError('retrievePlacements',error);
                        _this.placementLoading = false;
                        return;
                    }

                    placementResponse = placementResponse.items;
                    var len = placementResponse.length;
                    for(var i=0; i<len; i++){
                        var a = new AdPlacement().init(placementResponse[i]);
                        _this.placements.push(a);
                        _this.placementLoadingQueue.push(a);
                    }

                    _this.placementPagesLoaded ++ ;
                    if(placementResponse.length > 0) requestAnimationFrame(loadNextPage);
                    else {
                        _this.placementLoading = false;
                    }
                });
            } else requestAnimationFrame(loadNextPage);
        }
        loadNextPage();

        this.placementLoading = true;
        this.loading = true;

    },

    loadImages: function(){
        var _this = this;
        this.lastShaderUpdate --;

        var len = this.placementLoadingPool.length;
        for(var i=0; i<len; i++){
            var placement = this.placementLoadingPool[i];
            if(placement.error){
                this.placementLoadingPool.splice(i,1);
                i--;
                len--;
            } else if(placement.ready){
                var len2 = placement.impressions.length;
                for(var j=0; j<len2; j++){
                    var len3 = this.loadedPool.length;
                        if(!placement.impressions[j].placement) {
                            this.loadedPool.push(placement.impressions[j]);
                            placement.impressions[j].placement = placement;
                            this.countBeforeUpdatingGrid --;
                            this.impressionStepCounter --;
                        }
                }
                this.placementLoadedPool.push(placement);
                this.placementLoadingPool.splice(i,1);
                i--;
                len--;
            }
        }

        len = this.poolSize - this.placementLoadingPool;
        for(var i=0; i<len && this.placementLoadingQueue.length > 0; i++){
            var placement = this.placementLoadingQueue[0];
            placement.loadImage();
            this.placementLoadingPool.push(placement);
            this.placementLoadingQueue.shift();
        }

        if(this.lastShaderUpdate <= 0 && this.countBeforeUpdatingGrid <= 0 || (this.placementLoadingPool.length == 0 && this.placementLoadingQueue.length == 0 && !this.placementLoading)){

            this.lastShaderUpdate = 60;
            if(loader.running) loader.moveToBottom();

            if(!focusImpression || !focusImpression.focused) filters.sortMode.sort();
            atlas.init();
            filters.init();
            filters.filter(true);

            this.countBeforeUpdatingGrid = this.poolSize;
            this.lastImpressionCount = Math.max(0,this.loadedPool.length-1);

            if(this.impressionStepCounter < 0){
                this.impressionStepCounter = this.impressionStep;
                this.loading = false;
                this.placementLoading = true;
                if (verbose) console.log('Impression loading interrupted.');
            }

            if(this.placementLoadingPool.length == 0 && this.placementLoadingQueue.length == 0 && !this.placementLoading) {    

                this.loading = false;
                loader.remove();
                if (verbose) console.log("Impressions loading complete.");
                if(impressions.placementLoadedPool.length == 0){
                    d3.select('#container').append('p')
                        .html("Floodwatch hasn't collected enough ads yet. Browse more and come back later.</br><span>Learn more</span>")
                        .classed('errorMessage',true)
                        .style('opacity',0)
                        .transition()
                        .style('opacity',1)

                    d3.select('#container p.errorMessage span')
                        .on('click',function(){
                            toggleAbout(true);
                            d3.selectAll('div.nav div')
                                .classed('current',false)
                                .filter(function(d,i){return d3.select(this).text() == 'About'})
                                .classed('current',true);
                            requestAnimationFrame(function(){
                                d3.select('#about')
                                    .transition()
                                    .delay(300)
                                    .each('end',function(){
                                        d3.transition()
                                            .duration(700)
                                            .tween("scrollT", scrollTween(d3.select(this).select('div.howdoesitwork').node().offsetTop, this));
                                        function scrollTween(offset, target) {
                                            // console.log(target);
                                            return function() {
                                                var i = d3.interpolateNumber(target.scrollTop, offset)
                                                return function(t) { target.scrollTop = i(t); };
                                            }
                                        }
                                    });                                
                            });
                        })

                    d3.select('g.viewModeSlider').remove()
                    d3.select('#timeline svg').remove()
                }
            }

            counters.update();

        }

    },

    filter: function(filteredImpressions){

        var len = this.loadedPool.length;
        for(var i = 0; i<len; i++){
            this.loadedPool[i].filtered = false;
        }

        len = filteredImpressions.length;
        for(var i = 0; i<len; i++){
            filteredImpressions[i].filtered = true;
        }

        grid.init();
        if(grid.viewMode == 0) grid.initGrid();
        else grid.initTimeline();

        if(grid.viewMode == 1){
            timelineTicks.kill();
            timelineTicks.init();
        } 

        counters.update();

    }
}


AdPlacement = function(){

    this.data;
    this.id;
    this.imageLoaded = false;
    this.ready = false;
    this.error = false;
    this.impressions = [];

    this.actualSize = [];
    this.publisher; 
    this.domColor;
    this.keywords;
    this.numSeen;
    this.sortingKey = Math.random();
    this.earliestTimestamp;

    this.atlasPos = new THREE.Vector3(0,0,0);
    this.textureId = 0;
    this.width;
    this.height;
    this.format;
    this.texture;


}

AdPlacement.prototype = {
    constructor: AdPlacement,

    init: function(placementResponse){

        if (verbose) console.log(placementResponse);

        if(placementResponse == null){
            this.error = true;
            return this;
        }

        this.data = placementResponse;
        this.id = this.data.placement_id;
        this.numSeen = this.data.num_seen;

        if(this.data.dom_color){
            var c = this.data.dom_color.split(',');
            this.domColor = new THREE.Color('rgb(' + parseInt(c[0]) + ',' + parseInt(c[1]) + ',' + parseInt(c[2]) + ')');
        }

        try {
            this.keywords = this.data.keywords.split(',');

            if(keywords.keys[this.keywords[0]]){
                var id = this.keywords[0];
                this.keywords = [];
                while(id != 0){
                    this.keywords.push(+id);
                    id = keywords.keys[id].parent;
                }
            } else this.keywords = [];

            var len = this.keywords.length;
            for(var i = 0; i<len; i++){
                try{
                    tagTree.keys[this.keywords[i]].score ++;
                } catch(e){
                    // console.log(e + ' ' + this.keywords[i] + ' ' + impressions.loadedPool.length)
                }
            }
        } catch(e) {
            if (verbose) console.log(e + ' ' + this.keywords);
        }


        this.publisher = this.data.page_url;

        this.earliestTimestamp = new Date().getTime();
        // Bind to impressions
        var len = impressions.all.length;
        // console.log('binding: ' + this.id);
        for(var i=0; i<len; i++){
            var imp = impressions.all[i];
            if(imp.placement_id == this.id){
                this.impressions.push(imp);
                if(this.earliestTimestamp > imp.timestamp+imp.sortingKey) this.earliestTimestamp = imp.timestamp+imp.sortingKey;
            }
        }

        return this;

    },

    loadImage: function(){

        this.imageLoaded = true;
        var _this = this;
        chrome.extension.sendMessage({"whatKind":"retrieveThumbnail","imgId":_this.data.img_id}, function(imageResponse, error){


            if(error) {
                // displayError('retrieveThumbnail',error);
                _this.error = true;
                return;
            }

            // image response
            // {file: "dataimage_jpegbase64_9j_4QAYRXhpZgAASUkqAAgAAAAAAA…ItBL10CYa_Z0DC9dAB6BifTQSJLppoixzXrqjMHp_T66Yj__Z", size: "{163,90}"}

            if(imageResponse == null){
                _this.error = true;
                return;
            }

            var wh = imageResponse.size.substring(1,imageResponse.size.length-1).split(",");
            _this.width = wh[0];
            _this.height = wh[1];
            _this.format = _this.width/_this.height;
            _this.actualSize = [_this.width, _this.height];

            _this.width *= 0.5;
            _this.height *= 0.5;

            var img = new Image();
            img.src = imageResponse.file;
            _this.texture = new THREE.Texture(img);

            if(img.width == 0 || img.height == 0 || _this.width == 0 || _this.height == 0){
                _this.error = true;
                return;
            }

            if(!_this.domColor){
                var c;
                c = colorThief.getColor(img);
                _this.domColor = new THREE.Color('rgb(' + parseInt(c[0]) + ',' + parseInt(c[1]) + ',' + parseInt(c[2]) + ')');
                chrome.extension.sendMessage( { "whatKind":"updateColor", "imgID":_this.data.img_id, "color":c.toString()}, function(response){
                });
            }

            var hsl = _this.domColor.getHSL();               
            var minDist = 100000;
            var c = impressions.colorPalette[0];
            var len = impressions.colorPalette.length;
            for(var j = 0; j<len; j++){
                var d = Math.abs(hsl.h-impressions.colorPalette[j].x);
                if(hsl.s < 0.25) d = Math.abs(hsl.s-impressions.colorPalette[j].y);
                if(hsl.l < 0.18 || hsl.l > 0.82) d = Math.abs(hsl.l-impressions.colorPalette[j].z);
                if(d < minDist) {
                    minDist = d;
                    c = impressions.colorPalette[j];
                }
            }
            _this.color = new THREE.Color();
            _this.color.setHSL(c.x,c.y,c.z);

            var scale = (Math.round(_this.width/(width/grid.columnCount))*width/grid.columnCount)/_this.width;
            _this.width = Math.round(_this.width*scale);
            _this.height = Math.round(_this.height*scale);

            if(_this.width < 1 || _this.height < 1){
                _this.error = true;
                return;
            }

            if(impressions.loadedTimeRange[0] > _this.timestamp) impressions.loadedTimeRange[0] = _this.timestamp;
            _this.ready = true;

            var len = _this.impressions.length;
            for(var i=0; i<len; i++){
                var imp = _this.impressions[i];
                imp.filtered = filters.filterSingleAd(imp);
            }            

        });
    },

    setAtlasPosition: function(source) {

        var indexOf = Array.prototype.indexOf ?
        function( items, value ) {
            return items.indexOf( value );
        } :
        function ( items, value ) {
        for ( var i=0, len = items.length; i < len; i++ ) {
            var item = items[i];
            if ( item === value ) {
                return i;
            }
        }
        return -1;
        };

        var remainder = this.width % grid.columnWidth;
        var mathMethod = remainder && remainder < 1 ? 'round' : 'ceil';
        var colSpan = Math[ mathMethod ]( this.width / grid.columnWidth );
        colSpan = Math.min( colSpan, source.colYs.length );

        var colGroup = [];
        if ( colSpan < 2 ) {
            colGroup = source.colYs.slice(0);
        } else {
            var groupCount = source.colYs.length + 1 - colSpan;
            for ( var i = 0; i < groupCount; i++ ) {
                var groupColYs = source.colYs.slice( i, i + colSpan );
                colGroup[i] = Math.max.apply( Math, groupColYs );
            }
        }

        var minimumY = Math.min.apply( Math, colGroup );
        var shortColIndex = indexOf( colGroup, minimumY );

        if(minimumY+this.height > atlas.width){
            atlas.addTexture();
            grid.addMesh();
            this.setAtlasPosition(source);
            return;
        }

        this.textureId = atlas.textureId;
        this.atlasPos.set(grid.columnWidth * shortColIndex, minimumY, 0);

        var len = this.impressions.length;
        for(var i=0; i<len; i++){
            var imp = this.impressions[i];
            atlas.adPools[atlas.textureId].push(imp);
        }

        var setHeight = minimumY + this.height;
        var setSpan = source.colYs.length + 1 - colGroup.length;
        for ( var i = 0; i < setSpan; i++ ) {
          source.colYs[ shortColIndex + i ] = setHeight;
        }

    }

}


AdImpression = function(impressionResponse){

    // impression response
    // {"id":25,"placement_id":"0458a23ececbcc9654d728fc9b5bfbefcb60a9fa854b5d6bf842ec886f016eb9","timestamp":"Wed, 14 May 2014 14:54:26 GMT"}

    this.placement_id = optIn ? impressionResponse.placement_id : impressionResponse.impression.placement_id;
    this.placement;

    this.date = optIn ? impressionResponse.timestamp : impressionResponse.impression.timestamp;
    this.timestamp = optIn ? Date.parse(this.date)/1000 : this.date;
    this.sortingKey = Math.random();

    this.tpos;
    this.opos;
    this.ofading = 0;
    this.tfading = 0;

    this.ts = new THREE.Vector3(1,1,1);
    this.s = new THREE.Vector3(1,1,1);

    this.filtered = true;
    this.focused = false;
    this.removed = false;

}

AdImpression.prototype = {

    constructor: AdImpression,

    setGridPosition: function(source) {

        // console.log(this.placement.width, this.placement.height);
        // console.log(this.placement.width,this.placement.height, this.placement.aga);

        var indexOf = Array.prototype.indexOf ?
        function( items, value ) {
            return items.indexOf( value );
        } :
        function ( items, value ) {
        for ( var i=0, len = items.length; i < len; i++ ) {
            var item = items[i];
            if ( item === value ) {
                return i;
            }
        }
        return -1;
        };

        var remainder = this.placement.width % grid.columnWidth;
        var mathMethod = remainder && remainder < 1 ? 'round' : 'ceil';
        var colSpan = Math[ mathMethod ]( this.placement.width / grid.columnWidth );
        colSpan = Math.min( colSpan, source.colYs.length );


        var colGroup = [];
        if ( colSpan < 2 ) {
            colGroup = source.colYs.slice(0);
        } else {
            var groupCount = source.colYs.length + 1 - colSpan;
            for ( var i = 0; i < groupCount; i++ ) {
                var groupColYs = source.colYs.slice( i, i + colSpan );
                colGroup[i] = Math.max.apply( Math, groupColYs );
            }
        }

        // get smallest value of colGroup
        var minimumY = Math.min.apply( Math, colGroup );
        var shortColIndex = indexOf( colGroup, minimumY );


        if(this.tfading == 1) this.tfading = 0;
        var focusing = !focusImpression ? false : focusImpression.focused;
        if(this.opos) {
            this.opos.copy(this.tpos);
            this.ofading = this.tfading;
        }
        if(!this.tpos) this.tpos = new THREE.Vector3();
        this.tpos.set(grid.columnWidth * shortColIndex, minimumY, !focusing || this.focused ? 0:30);
        if(!this.opos) {
            this.opos = new THREE.Vector3();
            this.opos.copy(this.tpos);
            this.opos.z += 30;
            this.tfading = !focusing || this.focused ? 0:0.92;
            this.ofading = 1;
        }

        var setHeight = minimumY + this.placement.height;
        var setSpan = source.colYs.length + 1 - colGroup.length;
        for ( var i = 0; i < setSpan; i++ ) {
          source.colYs[ shortColIndex + i ] = setHeight;
        }

    },

    setTimelinePosition: function(x,y) {

        if(this.tfading == 1) this.tfading = 0;
        var focusing = !focusImpression ? false : focusImpression.focused;
        if(this.opos) {
            this.opos.copy(this.tpos);
            this.ofading = this.tfading;
        }

        if(!this.tpos) this.tpos = new THREE.Vector3();
        this.tpos.set(x*9,y*9,!focusing || this.focused ? 0:30);
        if(!this.opos) {
            this.opos = new THREE.Vector3();
            this.opos.copy(this.tpos);
            this.opos.z += 30;
            this.tfading = !focusing || this.focused ? 0:0.92;
            this.ofading = 1;
        }

    },

    removeFromLayout: function(){
        this.ofading = this.tfading;
        this.tfading = 1;
        if(!this.opos) {
            this.opos = new THREE.Vector3();
            this.ofading = 1;
        }
        if(!this.tpos) this.tpos = new THREE.Vector3();
        this.opos.copy(this.tpos);
        this.tpos.z = 31;
        this.filtered = false;
    },

    focus:function(){

        this.focused = true;

        var _this = this;
        var id = impressions.loadedPool.indexOf(this);

        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var imp = impressions.loadedPool[i];
            if(id != i){
                if(imp.opos) imp.opos.copy(imp.tpos);
                if((imp.filtered && !imp.removed) && imp.tpos) imp.tpos.z = 30;
                imp.ofading = imp.tfading;
                if((imp.filtered && !imp.removed))imp.tfading = 0.92;
            }
        }

        this.opos.copy(this.tpos);
        this.tpos.z = 0;
        this.ofading = this.tfading;
        this.tfading = 0;
        grid.updateShaders();

        if(this.tpos.x + this.placement.width + grid.tpos.x > width) grid.tpos.x -= (this.tpos.x + this.placement.width + grid.tpos.x) - width;

        var left = (this.tpos.x+this.placement.width/2)+grid.tpos.x > width/2;
        var w = 100;
        var h = Math.max(150,this.placement.height);
        var x = (left ? this.tpos.x-w : (this.tpos.x + this.placement.width))+grid.tpos.x;
        var y = this.tpos.y+grid.tpos.y;

        if(y<20){
            grid.tpos.y += (20-y);
            y = 20;
        }

        d3.select('#container div.hoverHitbox').remove();
        d3.select('#container').append('div')
            .classed('hoverHitbox',true)
            .style('top', -300 + 'px')
            .style('width',width+'px')
            .style('height', (+height+300) + 'px')
            .style('position','absolute')
            .on('mouseover',_this.unfocus);

        d3.select('#container div.info').remove();
        d3.select('#container').append('div')
            .classed('info',true)
            .style('height','auto')
            .style('width','200px')
            .style('position','absolute')
            .style('padding-' + (left?'right':'left'),'15px')
            .style('padding-bottom','20px')
            .style('left',x+'px')
            .style('top',y+'px');

        d3.select('#container div.clickHitbox').remove();
        d3.select('#container').append('div')
            .classed('clickHitbox',true)
            .style('width',_this.placement.width +'px')
            .style('height', h + 'px')
            .style('position','absolute')
            .style('left',_this.tpos.x+'px')
            .style('top',y+'px')
            .on('click',_this.unfocus);

        d3.select('#container canvas')
            .on('click',null)
            .on('mousemove',null);
        d3.select('#container')
            .on('mousewheel',null)
            .on('mousewheel',_this.unfocus);

        var d = new Date(this.timestamp*1000);

        var formatCounter = function(c){
            return (c.length<=1 || c<=9 ?'0':'') + c;
        }
        var mo = formatCounter(d.getMonth()+1);
        var da = formatCounter(d.getDate());
        var ye = formatCounter(d.getFullYear());
        var ho = formatCounter(d.getHours());
        var mi = formatCounter(d.getMinutes());

        d = mo + '/' + da + '/' + ye + ' ' + ho + ':' + mi;

        var themes = '';
        for(var i = 0; i<this.placement.keywords.length; i++){
            themes += keywords.keys[this.placement.keywords[i]].name + (i<this.placement.keywords.length-1 ? ', ':'');
        }

// $$$text
        var s = '<p class="adInfo"><span class="date"></span><br/><span class="publisher"></span><br/><span class="format"></span><span class="color"></span><span class="theme"></span><div class="flag"><p>Edit</p></div>';

        d3.select('#container div.info').html(s);
        d3.select('#container div.info span.date').text("Posted " + d + " while browsing");
        d3.select('#container div.info span.publisher').text(this.placement.publisher);
        d3.select('#container div.info span.format').text(this.placement.actualSize[0] + 'x' + this.placement.actualSize[1] + 'px');
			d3.select('#container div.info span.format').text(this.placement);
        if(_this.placement.keywords.length > 0) {
            d3.select('#container div.info span.theme')
                .html('<br/>')
                .append('text')
                .text(themes);
        }
        else d3.select('#container div.info span.theme')
            .html('Tag this post');
        
        d3.select('#container div.info')
            .style('font-size','14px')
            .style('line-height','1.6em');
        d3.selectAll('#container div.info p')
            .style('text-align',left?'right':'left')
            .style('margin',0);        

        w = d3.select('#container div.info p.adInfo').style('width');
        w = w.substring(0,w.length-2);
        x = left ? this.tpos.x-w+grid.tpos.x : this.tpos.x+grid.tpos.x + _this.placement.width;

        d3.select('#container div.info')
            .style('width',w+'px')
            .style('left',x-(left?15:0)+'px')

        d3.select('#container div.info span.color')
            .style('background-color',_this.placement.domColor.getHexString())
            .filter(function(){
                return _this.placement.domColor.getHexString() == '09090b';
            })
            .style('border','solid 1px #AAAAAA')
            .style('width','11px')
            .style('height','10px')
            .style('padding',0)

        var flagActive = false;
        d3.select('#container div.info div.flag')
            .style('float',left?'right':'left')
            .on('click',function(){
                flagActive = !flagActive;
                d3.select(this)
                    .style('height',flagActive?100:22)
            })
            .each(function(){
                d3.select(this)
                    .append('p')
                    .text('This is not an ad.')
                    .style('text-transform','uppercase')
                    .on('click',function(){
                        _this.remove();
                        _this.unfocus();
                        setTimeout(function(){
                            grid.initGrid();
                            grid.updateShaders();
                        },1000)
                    })
                d3.select(this)
                    .append('p')
                    .text('Edit ad tagging')
                    .style('text-transform','uppercase')
                    .on('click',function(){
                        tagAd(_this);
                    })
            })

            if(this.placement.keywords.length == 0){
                d3.select('span.theme')
                    .style('cursor','pointer')
                    .on('mouseover',function(){
                        d3.select(this)
                            .transition()
                            .duration(150)
                            .style('color','#7fbfff')
                    })
                    .on('mouseout',function(){
                        d3.select(this)
                            .transition()
                            .duration(150)
                            .style('color','#DDDDDD')
                    })
                    .on('click',function(){
                        tagAd(_this);
                    })

            }

    },

    unfocus: function(removed){

        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var imp = impressions.loadedPool[i];
            if(imp.filtered && !imp.removed){
                if(imp.opos) imp.opos.copy(imp.tpos);
                if(imp.tpos) imp.tpos.z = 0;
                imp.ofading = imp.tfading;
                imp.tfading = 0;
                imp.focused = false;
            }
        }

        filters.sortMode.sort();
        grid.updateShaders();

        d3.select('#container div.clickHitbox').remove();
        d3.select('#container div.hoverHitbox').remove();
        d3.select('#container div.info').remove();

        window.setTimeout(function(){
            d3.select('#container canvas')
                .on('click',function(){
                    if(focusImpression) focusImpression.focus();
                })
                .on('mousemove',function(){
                    checkForHover(d3.mouse(this));
                })
        },80);

        d3.select('#container')
            .on('mousewheel',scrollBehavior);

        focusImpression = null;

        if(grid.tpos.x < 0) grid.tpos.x = 0;
        if(grid.tpos.y > 0) grid.tpos.y = 0;

    },

    remove: function(){

        chrome.extension.sendMessage({"whatKind":"flagAd",'reason':'false_positive','placement_id':this.placement_id}, function(response, error){
            if(error) {
                displayError('flagAd',error);
                return;
            }
        });
        this.removed = true;
        var len = this.placement.impressions.length;
        for(var i=0; i<len; i++){
            var imp = this.placement.impressions[i];
            imp.removed = true;
            imp.tpos.z = 30;
            imp.tfading = 1;
            counters.offset ++;
            counters.update();
        }

    }
}





AdLayout = function(){
    this.columnCount = 16;
    this.columnWidth = width / 16;
    this.viewMode = 0;
    this.viewCount = 2;
    this.pos = new THREE.Vector3(0,0,0);
    this.tpos = new THREE.Vector3(0,0,0);

    this.meshes = [];
}

AdLayout.prototype = {

    consructor: AdLayout,

    init: function(){
        if(this.meshes.length == 0){
            this.addMesh();
        } else {
            this.updateMeshes();
        }
    },

    initGrid: function(){

        if(this.viewMode == 1) this.tpos = new THREE.Vector3(0,0,0);
        var i = this.columnCount;
        this.colYs = [];
        while (i--) {
            this.colYs.push( 0 );
        }

        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var a = impressions.loadedPool[i];
            if(a.filtered && !a.removed) a.setGridPosition(this);
            else a.removeFromLayout();
        }
       this.viewMode = 0;
       this.updateShaders();
       // d3.select('rect.timelineWindow').remove();

       if(timelineTicks.active) timelineTicks.kill();

    },

    initTimeline: function(){
        var timeRange = [10000000000, 0];
        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var imp = impressions.loadedPool[i];
            if(imp.filtered && !imp.removed){
                if(imp.timestamp < timeRange[0]) timeRange[0] = imp.timestamp;
                if(imp.timestamp > timeRange[1]) timeRange[1] = imp.timestamp;
            }
        }

        // this.tpos = new THREE.Vector3();
        this.tpos.y = 0;

        var h = 400;
        var colums = Math.round(width/9);
        var stacks = [];
        var colRange = [1000000,-1000000];

        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var imp = impressions.loadedPool[i];
            if(imp.filtered && !imp.removed){
                var x = Math.floor(map(imp.timestamp,timeRange[1]-3600*colums,timeRange[1],0,width/9-1));
                if(x<colRange[0]) colRange[0] = x;
                if(x>colRange[1]) colRange[1] = x;
                stacks[x] = !stacks[x] ? 1 : stacks[x]+1;
                imp.setTimelinePosition(x,stacks[x]);
            } else imp.removeFromLayout();
        }

        this.colXs = colRange[1]-colRange[0];
        this.viewMode = 1;
        this.updateShaders();

        var w = (impressions.timeRange[1]-impressions.timeRange[0])/3600*9;

        var range = [];
        range[0] = clamp(map(-width+grid.pos.x,-w,0,0,width),[0,width]);
        range[1] = clamp(map(grid.pos.x,-w*9,0,0,width),[0,width]);

        if(!timelineTicks.active) timelineTicks.init();
        else timelineTicks.update();

    },

    changeMode: function(){
        switch (this.viewMode){
            case 1:
                this.initGrid();
                break;
            case 0:
                this.initTimeline();
                break;  
        }
    },

    update: function(){
        var len = this.meshes.length;
        for(var i = 0; i<len; i++){
            var customUniforms = this.meshes[i].material.uniforms;
            this.pos.lerp(this.tpos,0.2);
            this.meshes[i].position.set(this.pos.x,this.pos.y,this.pos.z);
            customUniforms.ulerpamount.value = lerp(customUniforms.ulerpamount.value,1.0,0.2);
        }

        var _this = this;
        if(this.viewMode == 1 && Math.abs(this.tpos.x-this.pos.x) > 0.5){
            d3.select('svg.ticks').selectAll('g.tick')
                .attr('transform',function(d,i){
                    return 'translate(' + (_this.pos.x+parseFloat(width-(i*24+timelineTicks.hourOffset)*9-5)) + ',0)' 
                })
        }

        if(this.meshes.length > 0 && loader.running){
            if(this.viewMode==0){
                if(-Math.max.apply(null, grid.colYs) - this.tpos.y + parseInt(height) > 0 && impressions.placementLoading && !impressions.loading){
                    if (verbose) console.log('Placement loading resumed.');
                    impressions.loading = true;
                    impressions.loadPlacements();
                }
            }
        }

    },

    addMesh: function(){

        // console.log('addMesh');
        // geometry
        var geometry = new THREE.Geometry();
        var len = atlas.adPools[atlas.textureId].length;
        for(var i = 0; i<len; i++){
            var a = atlas.adPools[atlas.textureId][i];
            geometry.vertices.push(
                new THREE.Vector3(),
                new THREE.Vector3(),
                new THREE.Vector3(),
                new THREE.Vector3()
            );
            geometry.faces.push(
                new THREE.Face3(i*4+0, i*4+1, i*4+3),
                new THREE.Face3(i*4+1, i*4+2, i*4+3)
            );
            geometry.faceVertexUvs[0].push(
                [new THREE.Vector2( a.placement.uv.x, 1-(a.placement.uv.y) ),
                new THREE.Vector2( a.placement.uv.x, 1-(a.placement.uv.y+a.placement.height/atlas.width) ),
                new THREE.Vector2( a.placement.uv.x+a.placement.width/atlas.width, 1-(a.placement.uv.y) )]
            );
            geometry.faceVertexUvs[0].push(
                [
                new THREE.Vector2( a.placement.uv.x, 1-(a.placement.uv.y+a.placement.height/atlas.width) ),
                new THREE.Vector2( a.placement.uv.x+a.placement.width/atlas.width, 1-(a.placement.uv.y+a.placement.height/atlas.width) ),
                new THREE.Vector2( a.placement.uv.x+a.placement.width/atlas.width, 1-(a.placement.uv.y) ),
                ]
            );
        }

        // material
        var texture = new THREE.Texture(atlas.textures[this.meshes.length]);
        texture.needsUpdate = true;

        // var texpix = document.createElement('canvas');
        // texpix.width = atlas.width/10;
        // texpix.height = atlas.width/10;
        // var context = texpix.getContext('2d');
        // context.drawImage(atlas.textures[this.meshes.length],0,0,texpix.width,texpix.height);
        // var texture = new THREE.Texture(texpix);
        // texture.needsUpdate = true;

        var customUniforms = {
            utexture:   { type: "t", value: texture},
            ulerpamount: { type: "f", value: 1.0}
        };
        var customAttributes = {
            atpos: { type: "v3", value: []},
            aopos: { type: "v3", value: []},
            aofading: { type: "float", value: []},
            atfading: { type: "float", value: []},
            // acorneruv: { type: "v2", value: []},
            adims: { type: "v2", value: []}
        };

        // console.log('aga',geometry.vertices.length);
        for( var v = 0; v < geometry.vertices.length; v+=4 ) {
            var a = atlas.adPools[atlas.textureId][Math.floor(v/4)];
            for(var i = 0; i<4; i++){
                customAttributes.aopos.value[v+i] = new THREE.Vector3();
                customAttributes.atpos.value[v+i] = new THREE.Vector3();
                customAttributes.aofading.value[v+i] = 0;
                customAttributes.atfading.value[v+i] = 0;
                // customAttributes.acorneruv.value[v+i] = new THREE.Vector2(a.placement.uv.x,1-(a.placement.uv.y));
                customAttributes.adims.value[v+i] = new THREE.Vector2(a.placement.width/atlas.width,a.placement.height/atlas.width);
            }
        }
        
        // renderer.context.texParameteri( renderer.context.TEXTURE_2D, renderer.context.TEXTURE_MAG_FILTER, renderer.context.NEAREST );
        // renderer.context.texParameteri( renderer.context.TEXTURE_2D, renderer.context.TEXTURE_MIN_FILTER, renderer.context.NEAREST );

        // renderer.context.glTexParameteri( GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER, GL_NEAREST); 
        // renderer.context.glTexParameteri( GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER, GL_NEAREST);  

        var shaderMaterial = new THREE.ShaderMaterial({
            uniforms:       customUniforms,
            attributes:     customAttributes,
            vertexShader:   document.getElementById( 'vertexShader' ).textContent,
            fragmentShader: document.getElementById( 'fragmentShader' ).textContent
        });

        // mesh
        var mesh = new THREE.Mesh( geometry, shaderMaterial );
        mesh.frustumCulled = false;
        webglScene.add( mesh );
        this.meshes.push(mesh);
    },

    updateMeshes: function(){

        var geometry = new THREE.Geometry();

        var len = atlas.adPools[atlas.textureId].length;
        for(var i = 0; i<len; i++){
            var a = atlas.adPools[atlas.textureId][i];
            if(a.placement.uv){
                geometry.vertices.push(
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3()
                );
                geometry.faces.push(
                    new THREE.Face3(i*4+0, i*4+1, i*4+3),
                    new THREE.Face3(i*4+1, i*4+2, i*4+3)
                );
                geometry.faceVertexUvs[0].push(
                    [new THREE.Vector2( a.placement.uv.x, 1-(a.placement.uv.y) ),
                    new THREE.Vector2( a.placement.uv.x, 1-(a.placement.uv.y+a.placement.height/atlas.width) ),
                    new THREE.Vector2( a.placement.uv.x+a.placement.width/atlas.width, 1-(a.placement.uv.y) )]
                );
                geometry.faceVertexUvs[0].push(
                    [
                    new THREE.Vector2( a.placement.uv.x, 1-(a.placement.uv.y+a.placement.height/atlas.width) ),
                    new THREE.Vector2( a.placement.uv.x+a.placement.width/atlas.width, 1-(a.placement.uv.y+a.placement.height/atlas.width) ),
                    new THREE.Vector2( a.placement.uv.x+a.placement.width/atlas.width, 1-(a.placement.uv.y) ),
                    ]
                );
            }
        }

        var customAttributes = this.meshes[this.meshes.length-1].material.attributes;
        for( var v = (impressions.lastImpressionCount+1)*4; v < geometry.vertices.length; v+=4 ) {
            var a = atlas.adPools[atlas.textureId][Math.floor(v/4)];
            if(a.placement.uv){
                for(var i = 0; i<4; i++){
                    customAttributes.aopos.value[v+i] = new THREE.Vector3();
                    customAttributes.atpos.value[v+i] = new THREE.Vector3();
                    customAttributes.aofading.value[v+i] = 0;
                    customAttributes.atfading.value[v+i] = 0;
                    // customAttributes.acorneruv.value[v+i] = new THREE.Vector2(a.placement.uv.x,1-a.placement.uv.y);
                    customAttributes.adims.value[v+i] = new THREE.Vector2(a.placement.width/atlas.width,a.placement.height/atlas.width);
                }
            }
        }

        var customUniforms = this.meshes[this.meshes.length-1].material.uniforms;
        customUniforms.utexture.value.needsUpdate = true;

        webglScene.remove(this.meshes[this.meshes.length-1]);
        this.meshes[this.meshes.length-1] = new THREE.Mesh(geometry,this.meshes[this.meshes.length-1].material);
        this.meshes[this.meshes.length-1].frustumCulled = false;
        webglScene.add(this.meshes[this.meshes.length-1]);

    },


    updateShaders: function(){

        var l = this.meshes.length;
        for(var id = 0; id<l ; id++){

            var customAttributes = this.meshes[id].material.attributes;
            var customUniforms = this.meshes[id].material.uniforms;            

            var len = this.meshes[id].geometry.vertices.length;
            for( var v = 0; v < len; v+=4 ) {

                var a = atlas.adPools[id][Math.floor(v/4)];

                if(a.opos){
                    for(var i = 0; i<4; i++){
                        customAttributes.aofading.value[v+i] = a.ofading;
                        customAttributes.atfading.value[v+i] = a.tfading;
                        // customAttributes.acorneruv.value[v+i] = new THREE.Vector2(a.placement.uv.x,1-a.placement.uv.y);
                        customAttributes.adims.value[v+i] = new THREE.Vector2(a.placement.width/atlas.width,a.placement.height/atlas.width);
                    }

                    if(this.viewMode == 0 || (a.focused&& customAttributes.atpos.value[v+1].y-customAttributes.atpos.value[v].y!=8)){
                        customAttributes.aopos.value[v] = new THREE.Vector3(a.opos.x,a.opos.y,a.opos.z);
                        customAttributes.aopos.value[v+1] = new THREE.Vector3(a.opos.x,a.opos.y + a.placement.height,a.opos.z);
                        customAttributes.aopos.value[v+2] = new THREE.Vector3(a.opos.x + a.placement.width,a.opos.y + a.placement.height,a.opos.z);
                        customAttributes.aopos.value[v+3] = new THREE.Vector3(a.opos.x + a.placement.width,a.opos.y,a.opos.z);
                    } else {
                        customAttributes.aopos.value[v] = new THREE.Vector3(a.opos.x,a.opos.y,a.opos.z);
                        customAttributes.aopos.value[v+1] = new THREE.Vector3(a.opos.x,a.opos.y + 8,a.opos.z);
                        customAttributes.aopos.value[v+2] = new THREE.Vector3(a.opos.x + 8,a.opos.y + 8,a.opos.z);
                        customAttributes.aopos.value[v+3] = new THREE.Vector3(a.opos.x + 8,a.opos.y,a.opos.z);
                    }

                    if(this.viewMode == 0 || a.focused){
                        customAttributes.atpos.value[v] = new THREE.Vector3(a.tpos.x,a.tpos.y,a.tpos.z);
                        customAttributes.atpos.value[v+1] = new THREE.Vector3(a.tpos.x,a.tpos.y + a.placement.height,a.tpos.z);
                        customAttributes.atpos.value[v+2] = new THREE.Vector3(a.tpos.x + a.placement.width,a.tpos.y + a.placement.height,a.tpos.z);
                        customAttributes.atpos.value[v+3] = new THREE.Vector3(a.tpos.x + a.placement.width,a.tpos.y,a.tpos.z);
                    } else {
                        customAttributes.atpos.value[v] = new THREE.Vector3(a.tpos.x,a.tpos.y,a.tpos.z);
                        customAttributes.atpos.value[v+1] = new THREE.Vector3(a.tpos.x,a.tpos.y + 8,a.tpos.z);
                        customAttributes.atpos.value[v+2] = new THREE.Vector3(a.tpos.x + 8,a.tpos.y + 8,a.tpos.z);
                        customAttributes.atpos.value[v+3] = new THREE.Vector3(a.tpos.x + 8,a.tpos.y,a.tpos.z);
                    }
                    // console.log((v/4), a.ofading, a.tfading, a.opos, a.tpos, a.placement.width, a.placement.height);
                }
                // console.log(a.opos, a.tpos);
            }

            customAttributes.aopos.needsUpdate = true;
            customAttributes.atpos.needsUpdate = true;
            customAttributes.aofading.needsUpdate = true;
            customAttributes.atfading.needsUpdate = true;
            customAttributes.adims.needsUpdate = true;
            customUniforms.ulerpamount.value = 0;
            this.updateShadersPending = false;
            // customAttributes.acorneruv.needsUpdate = true;

        }

    }

}


AdAtlas = function(){

    var nearestPow2 = function(aSize){ 
        return Math.pow( 2, Math.floor( Math.log( aSize ) / Math.log( 2 ) ) );
    }
    var w = Math.min(8192,nearestPow2(renderer.getContext().getParameter(renderer.getContext().MAX_TEXTURE_SIZE)));

    if (verbose) console.log('Atlas texture size: ' + w + 'px');
    this.width = w;
    this.columnCount = Math.floor(8*this.width/width);
    this.textures = [];
    this.adPools = [];

}

AdAtlas.prototype = {

    consructor: AdAtlas,

    init: function(){

        var len = impressions.placementLoadedPool.length;
        for(var i = impressions.lastPlacementCount; i<len; i++){
            var p = impressions.placementLoadedPool[i];
            p.setAtlasPosition(this);
            p.uv = new THREE.Vector3();
            p.uv.copy(p.atlasPos);
            p.uv.divideScalar(this.width);
        }

        var context = this.textures[this.textureId].getContext('2d');
        for(var i = impressions.lastPlacementCount; i<len; i++){
            var p = impressions.placementLoadedPool[i];
            context.drawImage(p.texture.image,p.atlasPos.x,p.atlasPos.y,p.width,p.height);
        }

        impressions.lastPlacementCount = impressions.placementLoadedPool.length;

    },

    addTexture: function(){

        this.textureId = this.textures.length;
        this.adPools[this.textureId] = [];

        this.colYs = [];
        for(var i = 0; i<this.columnCount; i++){
            this.colYs.push( 0 );
        }
        this.textures.push(document.createElement('canvas'));
        this.textures[this.textureId].width = this.width;
        this.textures[this.textureId].height = this.width;
    }

}


FilterManager = function(){

    this.margin = 20;
    this.dom = d3.select("#filters div.single:nth-child(2)");
    this.w = this.dom.style('width').substring(0,this.dom.style('width').length-2);
    this.h = this.dom.style('height').substring(0,this.dom.style('height').length-2);

    this.list = {
        dateFilter: timeline,
        colorFilter: new ColorFilter(),
        publisherFilter: new PublisherFilter(),
        keywordFilter: new KeywordFilter(),
        timeFilter: new TimeFilter(),
        formatFilter: new FormatFilter()
    };


//CHANGE COLORS $$$
// FILTER BOX COLORS $$$



    for(f in this.list){
        d3.select(this.list[f].svg.node().parentNode)
            .style('background-color','#f6f6f6')
            .on('mouseover',function(){d3.select(this).transition().duration(200).ease("cubic-out").style('background-color','#f6f6f6')})
            .on('mouseout',function(){d3.select(this).transition().duration(200).ease("cubic-out").style('background-color','#f6f6f6')})
    }

    this.sortMode = new SortMode();
    this.viewModeSwitch = new ViewModeSwitch();
    this.loadMore = new LoadMoreLabel();
}

FilterManager.prototype = {

    constructor: FilterManager,

    init: function(){

        var _this = this;

        this.list.colorFilter.init();
        this.list.publisherFilter.init();
        //this.list.keywordFilter.init();
        this.list.timeFilter.init();
        this.list.formatFilter.init();

        if(!this.svg){
            this.svg = this.dom.append('svg')
                .style('margin-top',this.margin)
                .attr('height',this.h-20)
                .attr('width',this.w)
        }

        if(!this.viewModeSwitch.ready) this.viewModeSwitch.init();
        if(!this.sortMode.ready) this.sortMode.init();
        if(!this.loadMore.ready) this.loadMore.init();

    },

    filter: function(loadingNewImpression){

        var _this = this;

        var filteredImpressions = impressions.loadedPool;
        for(f in this.list) {
            filteredImpressions = this.list[f].filter(filteredImpressions);
            var p = this.list[f].dom.select('p');
            if(p && this.list[f].selectedFilters.length > 0) {
                p.style('color','#d5d5d5')	// $$$ filter names
            } else if(p){
                p.style('color','#d5d5d5')		// $$$ filter names
            }
        }

        impressions.filter(filteredImpressions);

        if(!loadingNewImpression){
            grid.tpos.y = 0;
            grid.tpos.x = 0;
        }

    },

    filterSingleAd: function(impression){

        var filtered = [impression];
        for(f in this.list) filtered = this.list[f].filter(filtered);
        return filtered.length == 1;

    },

}

LoadMoreLabel = function(){


}

LoadMoreLabel.prototype = {

    init: function(){

    }

}

SortMode = function(){

    this.margin = 20;
    this.dom = d3.select("#filters div.single:nth-child(2)");
    this.w = this.dom.style('width').substring(0,this.dom.style('width').length-2);
    this.h = this.dom.style('height').substring(0,this.dom.style('height').length-2)-this.margin*2;

    this.svg = this.dom.append('svg')
        .style('margin-top',this.margin+20)
        .attr('height',this.h-20)
        .attr('width',this.w)

    this.selectedMode = 0;

    this.ready = false;

}

SortMode.prototype = {

    constructor: SortMode,

    init: function(){

        var _this = this;
        this.ready = true;
        var modes = ['Recent', 'Placement', 'Uncommon'];

        if(d3.selectAll('g.sortModes')[0].length == 0){
            this.svg.append('g')
                .classed('sortModes',true)
        }

        d3.select('g.sortModes').selectAll('g.modes')
            .data(modes)
            .enter()
            .append('g')
            .style('cursor','pointer')
            .classed('modes',true)
            .on('click',function(d){_this.switchMode(this)})
            .on('mouseover',function(d) {
                d3.select(this).select('rect.bkg')
                    .attr('fill','rgba(152,218,255,0.9)')
            })
            .on('mouseout',function(d,i){
                var filtering = false
                if(this == _this.selectedMode){
                    filtering = true;
                } 
                d3.select(this).select('rect.bkg')
                    .transition()
                    .duration(150)
                    .attr('fill','rgba(152,218,255,' + (filtering ? 0.3 : 0.0) + ')')
            })
            .each(function(d,i){
                d3.select(this)
                    .append('rect')
                    .classed('bkg',true)
                    .attr('y',0)
                    .attr('width',_this.w+_this.margin*2)
                    .attr('height',20)
                    .attr('fill','rgba(255,255,255,0)')
                    
                d3.select(this)
                    .append('text')
                    .attr('x',_this.margin)
                    .attr('y',15)
                    .text( function (d) { return d })
                    .attr("font-family", "knockout")
                    .attr('letter-spacing', '0.05em')
                    .attr("font-size", "13px")
                    .attr('font-weight','lighter')
                    .attr('letter-spacing','0.1em')
                    .attr("fill", "#C5C5C5")	// $$$ FILTERS COLOR
                    .style('text-anchor', 'start')
                    .style('pointer-events', 'none');
                    
            })
            .filter(function(d,i){return i==0})
            .each(function(){
                d3.select(d3.select(this).node().children[0])
                    .transition()
                    .attr('fill','rgba(152,218,255,0.3)');
            })

        this.svg.selectAll('g.modes')
            .attr('transform',function(d,i){ return 'translate(0,' + (i*20-2) + ')' })

    },

    switchMode: function(t){

        var _this = this;
        this.svg.selectAll('g.modes')
            .each(function(d,i){
                if(this == t){
                    if(_this.selectedMode != this){
                        d3.select(this.children[0])
                            .transition()
                            .attr('fill','rgba(152,218,255,0.3)');
                    }
                } else {
                    d3.select(this.children[0])
                        .transition()
                        .attr('fill','rgba(152,218,255,0)');
                }
            })

        // if(this.selectedMode != t){
            this.selectedMode = t;
            this.sort(true);
        // }

    },

    sort: function(refresh){

        var _this = this;
        this.svg.selectAll('g.modes')
            .each(function(d,i){
                if(this == _this.selectedMode){
                    if(i==0){
                        // by ad placement
                        impressions.loadedPool.sort(function(a, b){ return d3.descending(a.placement.earliestTimestamp+a.sortingKey,b.placement.earliestTimestamp+b.sortingKey)});
                    } else if(i==1){
                        // by time
                        impressions.loadedPool.sort(function(a, b){ return d3.descending(a.timestamp+a.sortingKey,b.timestamp+b.sortingKey)});
                    } else if(i==2){
                        // by uniqueness
                        impressions.loadedPool.sort(function(a, b){ return d3.ascending(a.placement.numSeen + a.sortingKey,b.placement.numSeen + b.sortingKey)});
                    }
                }
            })

        if(refresh && grid.viewMode == 0){
            impressions.lastShaderUpdate = 60;
            if(loader.running) loader.moveToBottom();
            atlas.init();
            filters.filter(true);
        }

    }

}


ColorFilter = function(){

    this.margin = 20;
    this.dom = d3.select("#filters div.single:nth-child(5)");
    this.w = this.dom.style('width').substring(0,this.dom.style('width').length-2);
    this.h = this.dom.style('height').substring(0,this.dom.style('height').length-2)-this.margin*2;

    this.svg = this.dom.append('svg')
        .style('margin-top',this.margin+20)
        .attr('height',this.h-20)
        .attr('width',this.w)

    this.selectedFilters = [];

}

ColorFilter.prototype = {

    constructor: ColorFilter,

    init: function(){

        var _this = this;

        var colors = {};
        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var imp = impressions.loadedPool[i];
                if(imp.placement.color){
                    if(!colors[imp.placement.color.getHexString()]) colors[imp.placement.color.getHexString()] = 1;
                    else colors[imp.placement.color.getHexString()] ++;
                }
        }

        var colorRanking = [];
        for(var c in colors) colorRanking.push({id:c,total:colors[c]});
        var sorted = colorRanking.slice(0);
        sorted.sort(function(a, b){ return d3.descending(a.total,b.total)});

        if(d3.selectAll('g.colorFilter')[0].length == 0){
            this.svg.append('g')
                .classed('colorFilter',true)
                .on("mousewheel.zoom",function(){_this.scroll(d3.event)})
        }

        d3.select('g.colorFilter').selectAll('g.color')
            .data(colorRanking)
            .enter()
            .append('g')
            .classed('color',true)
            .style('cursor','pointer')
            .on('click',function(d){_this.addFilter(this)})
            .on('mouseover',function(d) {
                d3.select(this).select('rect.bkg')
                    .attr('fill','rgba(152,218,255,0.9)')
            })
            .on('mouseout',function(d){
                var filtering = false
                for(var i = 0; i<_this.selectedFilters.length; i++) {
                    if(this == _this.selectedFilters[i]){
                        filtering = true;
                        break;
                    }
                } 
                d3.select(this).select('rect.bkg')
                    .transition()
                    .duration(150)
                    .attr('fill','rgba(152,218,255,' + (filtering ? 0.3 : 0.0) + ')')
            })
            .each(function(d,i){
                d3.select(this)
                    .append('rect')
                    .classed('bkg',true)
                    .attr('y',0)
                    .attr('width',_this.w+_this.margin*2)
                    .attr('height',20)
                    .attr('fill','rgba(152,218,255,0)')
                    
                d3.select(this)
                    .append('rect')
                    .classed('key',true)
                    .attr('x',_this.margin)
                    .attr('y',5)
                    .attr('width',12)
                    .attr('height',12)
                    .attr('fill',function(d){return '#' + d.id})
                    .style('pointer-events', 'none');
                 
                 
                // COLOR numbers    
                d3.select(this)
                    .append('text')
                    .attr('x',_this.svg.attr('width')-_this.margin)
                    .attr('y',15)
                    .attr("font-family", "knockout")
                    .attr('letter-spacing', '0.05em')
                    .attr("font-size", "10px")
                    .attr('font-weight','lighter')
                    .attr('letter-spacing','0.1em')
                    .attr("fill", "#98daff") 		// $ COLOR
                    .style('text-anchor', 'end')
                    .style('pointer-events', 'none');

            })

        this.svg.selectAll('g.color')
            .attr('transform',function(d,i){ return 'translate(0,' + (sorted.indexOf(d)*20-2) + ')' })
            .select('text')
            .text( function (d) { return d.total })

        this.svg.selectAll('g.color')
            .select('rect.key')
            .attr('fill',function(d){return '#' + d.id})

    },

    addFilter: function(t){
        if(this.selectedFilters.indexOf(t) == -1){
            this.selectedFilters.push(t);
            d3.select(t.children[0])
                .transition()
                .attr('fill','rgba(152,218,255,0.3)');
        } else {
            d3.select(t.children[0])
                .transition()
                .attr('fill','rgba(152,218,255,0)');
            this.selectedFilters.splice(this.selectedFilters.indexOf(t),1);
        }

        var _this = this;
        filters.list['colorFilter'].dom.select('p')
            .html((this.selectedFilters.length>0?'<span>x</span> ('+this.selectedFilters.length+') col.':'colors'))
            .classed('filtered',this.selectedFilters.length>0)
            .on('click',function(){
                if(_this.selectedFilters.length>0){
                    _this.clear();
                }
            })

        filters.filter();
        loader.moveToBottom();

    },

    filter: function(impressionsIn){

        var impressionsOut = [];

        if(this.selectedFilters.length == 0) impressionsOut = impressionsIn;
        else {
            var impressionLength = impressionsIn.length;
            for(var i = 0; i< impressionLength; i++){
                var imp = impressionsIn[i];
                // var colorLength = imp.colors.length;
                // var flag = false;
                // for(var j = 0; j<colorLength; j++){
                //     var filterLength = this.selectedFilters.length;
                //     for(var k = 0; k<filterLength; k++){
                //         if(imp.colors[j].getHexString() == d3.select(this.selectedFilters[k]).datum().id){
                //             impressionsOut.push(imp);
                //             flag = true;
                //             break;
                //         }
                //     }
                //     if(flag) break;
                // }
                var filterLength = this.selectedFilters.length;
                for(var k = 0; k<filterLength; k++){
                    if(imp.placement.color.getHexString() == d3.select(this.selectedFilters[k]).datum().id){
                        impressionsOut.push(imp);
                        break;
                    }
                }
            }
        }
        return impressionsOut;
    },

    scroll: function(e){
        var _this = this;
        d3.select('g.colorFilter')
            .transition()
            .ease("cubic-out") 
            .attr('transform', function(){
                var t = d3.select(this).attr('transform');
                var y = 0;
                if(t) {
                    y = d3.select(this).attr('transform').split(',')[1];
                    y = y.substring(0,y.length-1);
                }
                y = +y + e.wheelDeltaY
                y = clamp(y,[-(this.children.length+1)*20+_this.h,0]);
                return 'translate(0,' + y + ')'
            });
    },

    clear: function(){
        d3.selectAll('g.color rect.bkg')
                .attr('fill','rgba(152,218,255,0)');
        this.selectedFilters = [];

        filters.list['colorFilter'].dom.select('p')
            .html('colors')
            .classed('filtered',false);

        filters.filter();
        loader.moveToBottom();
    }

}


PublisherFilter = function(){

    this.margin = 20;
    this.dom = d3.select("#filters div.single:nth-child(3)");
    this.w = this.dom.style('width').substring(0,this.dom.style('width').length-2);
    this.h = this.dom.style('height').substring(0,this.dom.style('height').length-2)-this.margin*2;

    this.svg = this.dom.append('svg')
        .style('margin-top',this.margin+20)
        .attr('height',this.h-20)
        .attr('width',this.w)

    this.selectedFilters = [];

}

PublisherFilter.prototype = {

    constructor: PublisherFilter,

    init: function(){

        var _this = this;
        var publishers = {};
        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var imp = impressions.loadedPool[i];
            // if(imp.filtered){
                if(!publishers[imp.placement.publisher]) publishers[imp.placement.publisher] = 1;
                else publishers[imp.placement.publisher] ++;
            // }
        }

        var publisherRanking = [];
        for(var c in publishers) publisherRanking.push({id:c,total:publishers[c]});

        var sorted = publisherRanking.slice(0);
        sorted.sort(function(a, b){ return d3.descending(a.total,b.total)});

        if(d3.selectAll('g.publisherFilter')[0].length == 0){
            this.svg.append('g')
                .classed('publisherFilter',true)
                .on("mousewheel.zoom",function(){_this.scroll(d3.event)})
        }

        // if(this.selectedFilters.length > 0) console.log(1, keywords.keys[d3.select(this.selectedFilters[0]).datum().id].name);

        d3.select('g.publisherFilter').selectAll('g.publisher')
            .data(publisherRanking)
            .enter()
            .append('g')
            .style('cursor','pointer')
            .classed('publisher',true)
            .on('click',function(d){_this.addFilter(this)})
            .on('mouseover',function(d) {
                d3.select(this).select('rect.bkg')
                    .attr('fill','rgba(152,218,255,0.9)')
            })
            .on('mouseout',function(d){
                var filtering = false
                for(var i = 0; i<_this.selectedFilters.length; i++) {
                    if(this == _this.selectedFilters[i]){
                        filtering = true;
                        break;
                    }
                } 
                d3.select(this).select('rect.bkg')
                    .transition()
                    .duration(150)
                    .attr('fill','rgba(152,218,255,' + (filtering ? 0.3 : 0.0) + ')')
            })
            .each(function(d,i){
                d3.select(this)
                    .append('rect')
                    .classed('bkg',true)
                    .attr('y',0)
                    .attr('width',_this.w+_this.margin*2)
                    .attr('height',20)
                    .attr('fill','rgba(152,218,255,0)')
                    
                d3.select(this)
                    .append('text')
                    .attr('x',_this.margin)
                    .attr('y',15)
                    .text( function (d) { 
                        var s = d.id;
                        if(s.length>18) s = s.substring(0,18)+'...';
                        return s 
                    })
                    .attr("font-family", "knockout")
                    .attr('letter-spacing', '0.05em')
                    .attr("font-size", "13px")
                    .attr('font-weight','lighter')
                    .attr('letter-spacing','0.1em')
                    .attr("fill", "#c5c5c5")	// $$$ SOURCES NAME COLOR
                    .style('text-anchor', 'start')
                    .style('pointer-events', 'none');
                    
                d3.select(this)
                    .append('text')
                    .attr('x',_this.svg.attr('width')-_this.margin)
                    .attr('y',15)
                    .attr("font-family", "knockout")
                    .attr('letter-spacing', '0.05em')
                    .attr("font-size", "13px")
                    .attr('font-weight','lighter')
                    .attr('letter-spacing','0.1em')
                    .attr("fill", "#C5C5C5")	// $$$	SOURCES COUNTER COLOR
                    .style('text-anchor', 'end');
            })

        // if(this.selectedFilters.length > 0) console.log(2, keywords.keys[d3.select(this.selectedFilters[0]).datum().id].name);

        this.svg.selectAll('g.publisher')
            .attr('transform',function(d,i){ return 'translate(0,' + (sorted.indexOf(d)*20-2) + ')' })
            .select('text:last-child')
            .text( function (d) { return d.total })

        
    },

    addFilter: function(t){

        if(this.selectedFilters.indexOf(t) == -1){
            this.selectedFilters.push(t);
            d3.select(t.children[0])
                .transition()
                .attr('fill','rgba(152,218,255,0.3)');
        } else {
            d3.select(t.children[0])
                .transition()
                .attr('fill','rgba(152,218,255,0)');
            this.selectedFilters.splice(this.selectedFilters.indexOf(t),1);
        }

        var _this = this;
        filters.list['publisherFilter'].dom.select('p')
            .html((this.selectedFilters.length>0?'<span>x</span> ('+this.selectedFilters.length+') ':'')+'publishers')
            .classed('filtered',this.selectedFilters.length>0)
            .on('click',function(){
                if(_this.selectedFilters.length>0){
                    _this.clear();
                }
            })

        filters.filter();
        loader.moveToBottom();

    },

    filter: function(impressionsIn){

        var impressionsOut = [];

        if(this.selectedFilters.length == 0) impressionsOut = impressionsIn;
        else {
            var impressionLength = impressionsIn.length;
            for(var i = 0; i< impressionLength; i++){
                var imp = impressionsIn[i];
                var filterLength = this.selectedFilters.length;
                for(var k = 0; k<filterLength; k++){
                    if(imp.placement.publisher == d3.select(this.selectedFilters[k]).datum().id){
                        impressionsOut.push(imp);
                        break;
                    }
                }
            }
        }
        return impressionsOut;
    },

    scroll: function(e){
        var _this = this;
        d3.select('g.publisherFilter')
            .transition()
            .ease("cubic-out") 
            .attr('transform', function(){
                var t = d3.select(this).attr('transform');
                var y = 0;
                if(t) {
                    y = d3.select(this).attr('transform').split(',')[1];
                    y = y.substring(0,y.length-1);
                }
                y = +y + e.wheelDeltaY
                y = clamp(y,[-(this.children.length+1)*20+_this.h,0]);
                return 'translate(0,' + y + ')'
            });
    },

    clear: function(){
        d3.selectAll('g.publisher rect.bkg')
                .attr('fill','rgba(152,218,255,0)');
        this.selectedFilters = [];

        filters.list['publisherFilter'].dom.select('p')
            .html('publishers')
            .classed('filtered',false);

        filters.filter();
        loader.moveToBottom();
    }

}

KeywordFilter = function(){

    this.margin = 20;
    this.dom = d3.select("#filters div.single:nth-child(4)");
    this.w = this.dom.style('width').substring(0,this.dom.style('width').length-2);
    this.h = this.dom.style('height').substring(0,this.dom.style('height').length-2)-this.margin*2;

    this.svg = this.dom.append('svg')
        .style('margin-top',this.margin+20)
        .attr('height',this.h-20)
        .attr('width',this.w)

    this.selectedFilters = [];
    this.selectedFiltersID = [];
}


KeywordFilter.prototype = {

    constructor: KeywordFilter,

    init: function(){

        // 1 if(this.selectedFilters.length > 0) console.log(frameCount, keywords.keys[d3.select(this.selectedFilters[0]).datum().id].name);

        var _this = this;

        var keywordList = {};
        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var imp = impressions.loadedPool[i];
                for(var j = 0; j<imp.placement.keywords.length; j++){
                    if(!keywordList[imp.placement.keywords[j]]) keywordList[imp.placement.keywords[j]] = 1;
                    else keywordList[imp.placement.keywords[j]] ++;
                }
        }

        // if(this.selectedFilters.length > 0) console.log(frameCount, keywords.keys[d3.select(this.selectedFilters[0]).datum().id].name);

        var keywordRanking = [];
        for(var c in keywordList) keywordRanking.push({id:c,total:keywordList[c]});
        var sorted = keywordRanking.slice(0);
        sorted.sort(function(a, b){ return d3.descending(a.total,b.total)});

        // if(this.selectedFilters.length > 0) console.log(frameCount, keywords.keys[d3.select(this.selectedFilters[0]).datum().id].name);

        if(d3.selectAll('g.keywordFilter')[0].length == 0){
            this.svg.append('g')
                .classed('keywordFilter',true)
                .on("mousewheel.zoom",function(){_this.scroll(d3.event)})
        }

        d3.select('g.keywordFilter').selectAll('g.keyword')
            .data(keywordRanking)
            .enter()
            .append('g')
            .style('cursor','pointer')
            .classed('keyword',true)
            .on('click',function(d){_this.addFilter(this)})
            .on('mouseover',function(d) {
                d3.select(this).select('rect.bkg')
                    .attr('fill','rgba(152,218,255,0.9)')
            })
            .on('mouseout',function(d){
                var filtering = false
                for(var i = 0; i<_this.selectedFilters.length; i++) {
                    if(this == _this.selectedFilters[i]){
                        filtering = true;
                        break;
                    }
                } 
                d3.select(this).select('rect.bkg')
                    .transition()
                    .duration(150)
                    .attr('fill','rgba(152,218,255,' + (filtering ? 0.3 : 0.0) + ')')
            })
            .each(function(d,i){
                d3.select(this)
                    .append('rect')
                    .classed('bkg',true)
                    .attr('y',0)
                    .attr('width',_this.w+_this.margin*2)
                    .attr('height',20)
                    .attr('fill','rgba(152,218,255,0)')
                    
                d3.select(this)
                    .append('text')
                    .classed('id',true)
                    .attr('x',_this.margin)
                    .attr('y',15)
                    .text( function (d) { return keywords.keys[d.id].name })
                    .attr("font-family", "knockout")
                    .attr('letter-spacing', '0.05em')
                    .attr("font-size", "13px")
                    .attr('font-weight','lighter')
                    .attr('letter-spacing','0.1em')
                    .attr("fill", "#c5c5c5")		// $$$	UNUSED? COLOR
                    .style('text-anchor', 'start')
                    .style('pointer-events', 'none');
                    
                d3.select(this)
                    .append('text')
                    .attr('x',_this.svg.attr('width')-_this.margin)
                    .attr('y',15)
                    .attr("font-family", "knockout")
                    .attr('letter-spacing', '0.05em')
                    .attr("font-size", "13px")
                    .attr('font-weight','lighter')
                    .attr('letter-spacing','0.1em')
                    .attr("fill", "#7FFF00")		//	UNUSED? $$$	COLOR
                    .style('text-anchor', 'end')
                    .style('pointer-events', 'none');
            })
        
        // if(this.selectedFilters.length > 0) console.log(frameCount, keywords.keys[d3.select(this.selectedFilters[0]).datum().id].name);

        this.svg.selectAll('g.keyword')
            .attr('transform',function(d,i){ return 'translate(0,' + (sorted.indexOf(d)*20-2) + ')' })
            .select('text:last-child')
            .text( function (d) { return d.total })

        // this.svg.selectAll('g.keyword')
        //     .select('text.id')
        //     .text( function (d) { 
        //         return keywords.keys[d.id].name;
        //     })

    },

    addFilter: function(t){
        if(this.selectedFilters.indexOf(t) == -1){
            this.selectedFilters.push(t);
            this.selectedFiltersID.push(d3.select(t).select('text.id').text());
            d3.select(t.children[0])
                .transition()
                .attr('fill','rgba(152,218,255,0.3)');
        } else {
            d3.select(t.children[0])
                .transition()
                .attr('fill','rgba(152,218,255,0)');
            this.selectedFilters.splice(this.selectedFilters.indexOf(t),1);
            this.selectedFiltersID.splice(this.selectedFilters.indexOf(t),1);
        }

        var _this = this;
        filters.list['keywordFilter'].dom.select('p')
            .html((this.selectedFilters.length>0?'<span>x</span> ('+this.selectedFilters.length+') ':'')+'themes')
            .classed('filtered',this.selectedFilters.length>0)
            .on('click',function(){
                if(_this.selectedFilters.length>0){
                    _this.clear();
                }
            })

        filters.filter();
        loader.moveToBottom();

    },

    filter: function(impressionsIn){

        var impressionsOut = [];

        if(this.selectedFilters.length == 0) impressionsOut = impressionsIn;
        else {
            var impressionLength = impressionsIn.length;
            for(var i = 0; i< impressionLength; i++){
                var imp = impressionsIn[i];
                var keywordLength = imp.placement.keywords.length;
                var flag = false;
                for(var j = 0; j<keywordLength; j++){
                    var filterLength = this.selectedFilters.length;
                    for(var k = 0; k<filterLength; k++){
                        if(imp.placement.keywords[j] == d3.select(this.selectedFilters[k]).datum().id){
                            impressionsOut.push(imp);
                            flag = true;
                            break;
                        }
                    }
                    if(flag) break;
                }
            }
        }
        return impressionsOut;
    },

    scroll: function(e){
        var _this = this;
        d3.select('g.keywordFilter')
            .transition()
            .ease("cubic-out") 
            .attr('transform', function(){
                var t = d3.select(this).attr('transform');
                var y = 0;
                if(t) {
                    y = d3.select(this).attr('transform').split(',')[1];
                    y = y.substring(0,y.length-1);
                }
                y = +y + e.wheelDeltaY
                y = clamp(y,[-(this.children.length+1)*20+_this.h,0]);
                return 'translate(0,' + y + ')'
            });
    },

    clear: function(){
        d3.selectAll('g.keyword rect.bkg')
                .attr('fill','rgba(255,255,255,0)');
        this.selectedFilters = [];
        this.selectedFiltersID = [];

        filters.list['keywordFilter'].dom.select('p')
            .html('themes')
            .classed('filtered',false);

        filters.filter();
        loader.moveToBottom();
    }
}


TimeFilter = function(){

    this.margin = 20;
    this.dom = d3.select("#filters div.double div.row:nth-child(1)");
    this.w = this.dom.style('width').substring(0,this.dom.style('width').length-2)-this.margin*2;
    this.h = this.dom.style('height').substring(0,this.dom.style('height').length-2)-this.margin*2;
    this.timeFormat = d3.time.format("%I:%M%p")

    var _this = this;
    var drag = d3.behavior.drag()
        .on('dragstart', function() {
            _this.initSelection(d3.event);
        })
        .on('drag', function() {
            _this.dragSelection(d3.event);
        })
        .on('dragend', function() {
            _this.endSelection(d3.event);
        })

    this.svg = this.dom.append('svg')
        .style('margin-left',this.margin)
        .style('margin-top',this.margin)
        .attr('width',this.w)
        .attr('height',this.h+1)
        .call(drag);

    this.svg
        .on('mouseover', function() {
            var x = d3.mouse(this)[0]+1;
            d3.select(' line.hover').remove();
            _this.svg
                .append('line')
                .attr('x1',x)
                .attr('x2',x)
                .attr('y2',_this.h)
                .attr('stroke','#7fbfff')
                .attr('stroke','#7fbfff')
                .style('pointer-events','none')
                .classed('hover',true)

            var left = d3.mouse(this)[0] >= _this.w/2;
            d3.select(' text.label').remove();

            var t = Math.round(map(x,0,_this.w,0,24*3600*1000));
            var d = new Date(t);
            d.setHours(d.getHours()+6);

            _this.svg
                .append('text')
                .attr('x',x + (left ? -10:10))
                .attr('y',_this.h-12)
                .text(_this.timeFormat(d))
                .style('text-anchor', (left ? 'end':'start'))
                .attr('font-size', '12px')
                .attr('fill', '#98daff')
                .style('pointer-events','none')
                .classed('label',true);
        })
        .on('mouseout', function() {
            d3.select(' line.hover').remove();
            d3.select(' text.label').remove();
        })
        .on('mousemove', function() {
            var x = d3.mouse(this)[0]+1;
            d3.select(' line.hover')
                .transition()
                .ease('cubic-out')
                .attr('x1',x)
                .attr('x2',x);

            var t = Math.round(map(x,0,_this.w,0,24*3600*1000));
            var d = new Date(t);
            d.setHours(d.getHours()+6);
            var left = d3.mouse(this)[0] >= _this.w/2;
            d3.select(' text.label')
                .text(_this.timeFormat(d))
                .style('text-anchor', (left ? 'end':'start'))
                .transition()
                .ease('cubic-out')
                .attr('x',x + (left ? -10:10))
        })

    this.selection;
    this.selectedFilters = [];
        
}


TimeFilter.prototype = {

    constructor: TimeFilter,

    init: function(){

        if(this.selectedFilters.length == 1){
            var d = d3.select('g.timeFilter rect.selection')
            var lastX = d.attr('x');
            var lastWidth = d.attr('width');
        }

        var x = d3.scale.linear().range([0, this.w]);
        var y = d3.scale.linear().range([this.h, 0]);
        var line = d3.svg.line()
            .x(function(d) { return x(d.time); })
            .y(function(d) { return y(d.total); });

        var times = [];
        for(var i = 0; i<48; i++) times.push({time:map(i,0,48,0,1440),total:(i==0||i==Math.floor(47))?0:0});
        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            var d = new Date(impressions.loadedPool[i].timestamp*1000);
            var t = d.getHours()*60 + d.getMinutes();
            var id = Math.floor(map(t,0,1440,1,47-1));
            times[id].total ++;
        }

        x.domain(d3.extent(times, function(d) { return d.time; }));
        y.domain(d3.extent(times, function(d) { return d.total; }));
        this.timeScale = x;

        if(!d3.select('g.timeFilter').node()){
            var timeFilter = this.svg.append('g')
                .classed('timeFilter',true)
                .style('cursor','pointer')
                .selectAll('timeFilter');

            timeFilter = d3.select('g.timeFilter');

            timeFilter.append('rect')
                .attr('x',0)
                .attr('y',0)
                .attr('width',this.w)
                .attr('height',this.h)
                .attr('fill','rgba(152,218,255,0)');

            timeFilter.append('path')
                .datum(times)
                .attr('class', 'sparkline')
                .attr('d',line)
                .attr('fill','#152,218,255,');

            timeFilter.append('rect')
                .attr('x',0)
                .attr('y',Math.round(this.h-1))
                .attr('width',this.w)
                .attr('height',1)
                .attr('fill','##7fff00')
        } else {
            d3.select('g.timeFilter path.sparkline')
                .datum(times)
                .attr('d',line)
        }

    },

    initSelection: function(e){
        var filter = d3.select('g.timeFilter');
        this.selectionOrigin = d3.mouse(filter.node())[0];
        this.selection = filter.append('rect')
            .classed('selection', true)
            .attr('x',this.selectionOrigin)
            .attr('y',0)
            .attr('width',0)
            .attr('height',this.h-1)
            .attr('fill','rgba(152,218,255,0.7)')
    },

    dragSelection: function(e){
        if(e.x-this.selectionOrigin-this.margin >= 0){
            this.selection
                .attr('width',clamp((e.x-this.selectionOrigin-this.margin),[0,this.w-this.selectionOrigin-1]))
        } else {
            this.selection
                .attr('x',clamp(this.selectionOrigin+(e.x-this.selectionOrigin-this.margin),[1,this.w-1]))
                .attr('width',clamp(-(e.x-this.selectionOrigin-this.margin),[0,this.selectionOrigin-1]));
        }
    },

    endSelection: function(e){

        this.selectedFilters = [];

        if(this.lastSelection) this.lastSelection.remove();
        this.selection.remove();

        var filter = d3.select('g.timeFilter');
        this.lastSelection = filter.append('rect')
            .classed('selection', true)
            .attr('x',this.selectionOrigin)
            .attr('y',0)
            .attr('width',20)
            .attr('height',this.h-1)
            .attr('fill','rgba(152,218,255,0.3)');

        var x = d3.mouse(filter.node())[0];
        if(x-this.selectionOrigin >= 0){
            this.lastSelection
                .attr('width',clamp((x-this.selectionOrigin),[0,this.w-this.selectionOrigin-1]))
        } else {
            this.lastSelection
                .attr('x',clamp(this.selectionOrigin+(x-this.selectionOrigin),[1,this.w-1]))
                .attr('width',clamp(-(x-this.selectionOrigin),[0,this.selectionOrigin-1]));
        }

        if(this.lastSelection.attr('width')<5){
            this.clear();
            return;
        }

        this.selectedFilters.push(this.lastSelection);

        var _this = this;
        filters.list['timeFilter'].dom.select('p')
            .html((this.selectedFilters.length>0?'<span>x</span> ':'')+'time of the day')
            .classed('filtered',this.selectedFilters.length>0)
            .on('click',function(){
                if(_this.selectedFilters.length>0){
                    _this.clear();
                }
            })

        filters.filter();
        loader.moveToBottom();

    },

    filter: function(impressionsIn){

        var impressionsOut = [];

        if(this.selectedFilters.length == 0) impressionsOut = impressionsIn;
        else {
            var filterRange = [this.timeScale.invert(this.lastSelection.attr('x')-2),this.timeScale.invert(parseFloat(this.lastSelection.attr('x'))+parseFloat(this.lastSelection.attr('width'))+4)];
            var len = impressionsIn.length;
            for(var i = 0; i<len; i++){
                var imp = impressionsIn[i];
                var d = new Date(imp.timestamp*1000);
                var t = d.getHours()*60 + d.getMinutes();
                if(t >= filterRange[0] && t <= filterRange[1]) impressionsOut.push(imp);
            }
        }
        return impressionsOut;
    },

    clear: function(){
        d3.select('g.timeFilter rect.selection').remove();
        this.selectedFilters = [];

        filters.list['timeFilter'].dom.select('p')
            .html('time of the day')
            .classed('filtered',false);

        filters.filter();
        loader.moveToBottom();
    }
}



FormatFilter = function(){

    this.margin = 20;
    this.dom = d3.select("#filters div.double div.row:nth-child(2)");
    this.w = this.dom.style('width').substring(0,this.dom.style('width').length-2)-this.margin*2;
    this.h = this.dom.style('height').substring(0,this.dom.style('height').length-2)-this.margin*2;

    var _this = this;
    var drag = d3.behavior.drag()
        .on('dragstart', function() {
            _this.initSelection(d3.event);
        })
        .on('drag', function() {
            _this.dragSelection(d3.event);
        })
        .on('dragend', function() {
            _this.endSelection(d3.event);
        })

    this.svg = this.dom.append('svg')
        .style('margin-left',this.margin)
        .style('margin-top',this.margin)
        .attr('width',this.w)
        .attr('height',this.h+1)
        .call(drag);

    this.svg
        .on('mouseover', function() {
            var x = d3.mouse(this)[0]+1;
            d3.select(' line.hover').remove();
            _this.svg
                .append('line')
                .attr('x1',x)
                .attr('x2',x)
                .attr('y2',_this.h-1)
                .attr('stroke','#7fbfff')
                .attr('stroke','#7fbfff')
                .style('pointer-events','none')
                .classed('hover',true)

            var left = d3.mouse(this)[0] >= _this.w/2;
            d3.select(' rect.label').remove();

            var t = Math.round(map(x,0,_this.w,0,24*3600*1000));
            var d = new Date(t);
            d.setHours(d.getHours()+6);

            if(_this.formatScale){
                var formatRange = [20,0.05];
                var ratio = 1/map(Math.pow(d3.mouse(this)[0],1/15),0,Math.pow(_this.w,1/15),formatRange[0],formatRange[1]);
                var w = constrain(14*ratio,2,35);
                var h = constrain(14/ratio,2,35);

                _this.svg
                    .append('rect')
                    .attr('x',x + (left ? -(10+w/2):10+w/2)-w/2)
                    .attr('y',_this.h/2-h/2)
                    .attr('width',w)
                    .attr('height',h)
                    .attr('fill', '#98Daff')
                    .style('pointer-events','none')
                    .classed('label',true);
            }
        

        })
        .on('mouseout', function() {
            d3.select(' line.hover').remove();
            d3.select(' rect.label').remove();
        })
        .on('mousemove', function() {
            var x = d3.mouse(this)[0]+1;
            d3.select(' line.hover')
                .transition()
                .ease('cubic-out')
                .attr('x1',x)
                .attr('x2',x);

            if(d3.select('rect.label').node()){
                var left = d3.mouse(this)[0] >= _this.w/2;
                var formatRange = [20,0.05];
                var ratio = 1/map(Math.pow(d3.mouse(this)[0],1/15),0,Math.pow(_this.w,1/15),formatRange[0],formatRange[1]);
                var w = constrain(14*ratio,2,35);
                var h = constrain(14/ratio,2,35);
                d3.select(' rect.label')
                    .transition()
                    .ease('cubic-out')
                    .attr('x',x + (left ? -(10+w/2):10+w/2)-w/2)
                    .attr('y',_this.h/2-h/2)
                    .attr('width',w)
                    .attr('height',h)
            }
        })

    this.selection;
    this.selectedFilters = [];
        
}


FormatFilter.prototype = {

    constructor: FormatFilter,

    init: function(){

        if(this.selectedFilters.length == 1){
            var d = d3.select('g.formatFilter rect.selection')
            var lastX = d.attr('x');
            var lastWidth = d.attr('width');
        }

        var filter = this;

        var x = d3.scale.linear().range([0, this.w]);
        var y = d3.scale.linear().range([this.h, 0]);
        var line = d3.svg.line()
            .x(function(d) { return x(d.format); })
            .y(function(d) { return y(d.total)-1; });

        var len = impressions.loadedPool.length;
        var formatRange = [20,0.05];
        var formats = [];
        for(var i = 0; i<48; i++) {
            formats.push({format:map(Math.pow(i+1,15),Math.pow(1,15),Math.pow(49,15),formatRange[0],formatRange[1]),total:(i==0||i==Math.floor(47))?0:0});
            // formats.push({format:map(i,0,48,formatRange[0],formatRange[1]),total:(i==0||i==Math.floor(47))?0:0});
        }
        for(var i = 0; i<len; i++){
            var imp = impressions.loadedPool[i];
            if(imp.placement.format){
                var id = constrain(Math.floor(map(imp.placement.format,formatRange[0],formatRange[1],1,47-1)),1,47-1);
                formats[id].total ++;
            }
        }

        x.domain(d3.extent(formats, function(d) { return d.format; }));
        y.domain(d3.extent(formats, function(d) { return d.total; }));
        this.formatScale = x;

        if(!d3.select('g.formatFilter').node()){
            var formatFilter = this.svg.append('g')
                .classed('formatFilter',true)
                .style('cursor','pointer')
                .selectAll('formatFilter');

            formatFilter = d3.select('g.formatFilter');

            formatFilter.append('rect')
                .attr('x',0)
                .attr('y',0)
                .attr('width',this.w)
                .attr('height',this.h)
                .attr('fill','rgba(255,255,255,0)');

            formatFilter.append('path')
                .datum(formats)
                .attr('class', 'sparkline')
                .attr('d',line)
                .attr('fill','#d5d5d5');

            formatFilter.append('rect')
                .attr('x',0)
                .attr('y',Math.round(this.h-2))
                .attr('width',this.w)
                .attr('height',1)
                .attr('fill','#d5d5d5')
        } else {
            d3.select('g.formatFilter path.sparkline')
                .datum(formats)
                .attr('d',line)
        }

    },

    initSelection: function(e){

        var filter = d3.select('g.formatFilter');
        this.selectionOrigin = d3.mouse(filter.node())[0];
        this.selection = filter.append('rect')
            .classed('selection', true)
            .attr('x',this.selectionOrigin)
            .attr('y',0)
            .attr('width',0)
            .attr('height',this.h-2)
            .attr('fill','rgba(152,218,255,0.7)')
    },

    dragSelection: function(e){
        if(e.x-this.selectionOrigin-this.margin >= 0){
            this.selection
                .attr('width',clamp((e.x-this.selectionOrigin-this.margin),[0,this.w-this.selectionOrigin-1]))
        } else {
            this.selection
                .attr('x',clamp(this.selectionOrigin+(e.x-this.selectionOrigin-this.margin),[1,this.w-1]))
                .attr('width',clamp(-(e.x-this.selectionOrigin-this.margin),[0,this.selectionOrigin-1]));
        }
    },

    endSelection: function(e){

        this.selectedFilters = [];

        if(this.lastSelection) this.lastSelection.remove();
        this.selection.remove();

        var filter = d3.select('g.formatFilter');
        this.lastSelection = filter.append('rect')
            .classed('selection', true)
            .attr('x',this.selectionOrigin)
            .attr('y',0)
            .attr('width',20)
            .attr('height',this.h-2)
            .attr('fill','rgba(152,218,255,0.3)');

        var x = d3.mouse(filter.node())[0];
        if(x-this.selectionOrigin >= 0){
            this.lastSelection
                .attr('width',clamp((x-this.selectionOrigin),[0,this.w-this.selectionOrigin-1]))
        } else {
            this.lastSelection
                .attr('x',clamp(this.selectionOrigin+(x-this.selectionOrigin),[1,this.w-1]))
                .attr('width',clamp(-(x-this.selectionOrigin),[0,this.selectionOrigin-1]));
        }

        if(this.lastSelection.attr('width')<5){
            this.clear();
            return;
        }

        this.selectedFilters.push(this.lastSelection);

        var _this = this;
        filters.list['formatFilter'].dom.select('p')
            .html((this.selectedFilters.length>0?'<span>x</span> ':'')+'format')
            .classed('filtered',this.selectedFilters.length>0)
            .on('click',function(){
                if(_this.selectedFilters.length>0){
                    _this.clear();
                }
            })

        filters.filter();
        loader.moveToBottom();

    },

    filter: function(impressionsIn){

        var impressionsOut = [];
        if(this.selectedFilters.length == 0) impressionsOut = impressionsIn;
        else {
            var formatRange = [20,0.05];
            var filterRange = [1/map(Math.pow((this.lastSelection.attr('x')-2),1/15),0,Math.pow(this.w,1/15),formatRange[0],formatRange[1]),
                               1/map(Math.pow((parseFloat(this.lastSelection.attr('x'))+parseFloat(this.lastSelection.attr('width'))+4),1/15),0,Math.pow(this.w,1/15),formatRange[0],formatRange[1])];

            var len = impressionsIn.length;
            for(var i = 0; i<len; i++){
                var imp = impressionsIn[i];
                if(imp.placement.format>= filterRange[0] && imp.placement.format <= filterRange[1]) impressionsOut.push(imp);
            }
        }
        return impressionsOut;
    },

    clear: function(){
        this.selectedFilters = [];
        if(this.lastSelection) this.lastSelection.remove();

        filters.list['formatFilter'].dom.select('p')
            .html('format')
            .classed('filtered',false);

        filters.filter();
        loader.moveToBottom();
    }
}



KeywordTree = function(){

    this.keys = {};
    this.ids = {};
    this.topLevel = [];

    var len = adWords.length;
    for(var i = 0; i<len; i++){
        var k = {id: adWords[i].tag_id, name: adWords[i].tag_name, parent: adWords[i].parent_id, children: [], score: 0}
        this.keys[k.id] = k;
        this.ids[k.name] = k.id;
        if(k.parent == 0) this.topLevel.push(k);
    }

    for(key in this.keys){
        var k = this.keys[key];
        if(k.parent != 0) this.keys[k.parent].children.push(k);
    }

    var setLevel = function(tags, level){
        var len = tags.length;
        for(var i =0; i<len; i++){
            var t = tags[i];
            t.level = level;
            setLevel(t.children,level+1);
        }
    }
    setLevel(this.topLevel, 0);

}


KeywordTree.prototype = {

    constructor: KeywordTree

}


ViewModeSwitch = function(){

    this.margin = 20;
    this.dom = d3.select("div.viewControls div.sliderBkg");
    this.ready = false;

}

ViewModeSwitch.prototype = {

    constructor: ViewModeSwitch,

    init: function(){

        var _this = this;
        this.ready = true;

        this.dom
            .on('click',function(){_this.switchView(_this)})

    },

    switchView: function(_this){
        // console.log()
        if(this.ready){

            this.dom.select('div.slider')
                .transition()
                .style('top',function(){
                    return (grid.viewMode == 0 ? 1 : 26) + 'px';
                })
            grid.changeMode();
        }

    }

}


Timeline = function(){

    this.dom = d3.select("#timeline");
    this.w = this.dom.style('width').substring(0,this.dom.style('width').length-2);
    this.h = this.dom.style('height').substring(0,this.dom.style('height').length-2);
    this.cursorWidth = this.h/2;

    var _this = this;
    var drag = d3.behavior.drag()
        .on('dragstart', function() {
            if(grid.viewMode == 0) _this.initSelection(d3.event);
        })
        .on('drag', function() {
            if(grid.viewMode == 0) _this.dragSelection(d3.event);
        })
        .on('dragend', function() {
            if(grid.viewMode == 0) _this.endSelection(d3.event);
        })

    this.svg = this.dom.append('svg')
        .attr('width',this.w)
        .attr('height',this.h)
        .style('cursor','pointer')
        .call(drag);

        this.selection;
        this.selectedFilters = [];

}


Timeline.prototype = {

    constructor: Timeline,

    init: function(){

        var _this = this;

        this.today = new Date(impressions.timeRange[1]*1000);
        this.yesterday = new Date();
        this.yesterday.setDate(this.today.getDate()-1);
        this.size = [width-this.cursorWidth*2, this.h*0.8];
        this.values = [this.yesterday.getTime()/1000,this.today.getTime()/1000];

        var domain = d3.range(impressions.timeRange[0], impressions.timeRange[1]);
        this.timeScale = d3.scale.linear()
            .range([0, this.size[0]-1])
            .domain(d3.extent(domain));

        this.initSparkLine();
        // this.initLoadedWindow();
        // this.initLoadingWindow();

        var formatCounter = function(c){
            return (c.length<=1 || c<=9 ?'0':'') + c;
        }
        var d = new Date(impressions.timeRange[0]*1000);
        var mo = formatCounter(d.getMonth()+1);
        var da = formatCounter(d.getDate());
        var ye = formatCounter(d.getFullYear());
        d = mo + '.' + da + '.' + ye;
        this.svg
            .append('text')
            .attr('x',20)
            .attr('y',17)
            .text('' + d)
            .attr("font-family", "knockout")
            .attr('letter-spacing', '0.05em')
            .attr("font-size", "10px")
            .attr('font-weight','200')
            .attr('letter-spacing','0.1em')
            .attr("fill", "#d5d5d5")		// $$$ START DATE COLOR
            .style('text-anchor', 'start')
            .style('pointer-events', 'none');

        d = new Date(impressions.timeRange[1]*1000);
        mo = formatCounter(d.getMonth()+1);
        da = formatCounter(d.getDate());
        ye = formatCounter(d.getFullYear());
        d = mo + '.' + da + '.' + ye;
        this.svg
            .append('text')
            .attr('x',_this.w-18)
            .attr('y',17)
            .text('' + d)
            .attr("font-family", "knockout")
            .attr('letter-spacing', '0.05em')
            .attr("font-size", "10px")
            .attr('font-weight','200')
            .attr('letter-spacing','0.1em')
            .attr("fill", "#d5d5d5")		// $$$  END DATE COLOR
            .style('text-anchor', 'end')
            .style('pointer-events', 'none');

    },

    initSparkLine: function(){

        var _this = this;
        var x = d3.scale.linear().range([_this.cursorWidth, width-_this.cursorWidth]);
        var y = d3.scale.linear().range([this.h, this.h-this.size[1]]);
        var line = d3.svg.line()
            .x(function(d) { return x(d.date); })
            .y(function(d) { return y(d.total); });

        this.timeScale = d3.scale.linear().range([_this.cursorWidth, width-_this.cursorWidth]);

        var values = [];
        for(var i = 0; i<width/5; i++) values.push({date:i,total:(i==0||i==Math.floor(width/5))?0:0});
        var len = impressions.all.length;
        for(var i = 0; i<len; i++){
            var id = Math.floor(map(impressions.all[i].timestamp,impressions.timeRange[0],impressions.timeRange[1],1,width/5-1));
            values[id].total ++;
        }

        x.domain(d3.extent(values, function(d) { return d.date; }));
        y.domain(d3.extent(values, function(d) { return d.total; }));

        this.svg.append('path')
            .datum(values)
            .attr('class', 'sparkline')
            .attr('id', 'timeline-data')
            .attr('d', line)
            .attr("fill","#c5c5c5");		// $$$ TIMELINE DATA COLOR

    },

    initLoadedWindow: function(){
        var _this = this;
        this.svg
            .append('rect')
            .classed('loadedWindow', true)
            .attr('height',this.h-1)
            .attr('y',1)
            .attr('x',1)
            .attr("fill", "rgba(152,218,255,0.5)")	// $$$ 
            .attr('width',0)
            .transition()
            .duration(1000)
            .attr('width', map(impressions.loadedTimeRange[0],impressions.timeRange[0],impressions.timeRange[1],0,timeline.size[0]+_this.cursorWidth*2)-3)
    },

    initLoadingWindow: function(){
        // var _this = this;
        // this.svg
        //     .append('rect')
        //     .classed('loadedWindow', true)
        //     .attr('height',this.h-1)
        //     .attr('y',1)
        //     .attr('x',1)
        //     // .attr("fill", "rgba(0,0,0,0.5)")
        //     .attr("fill", "rgba(255,0,0,0.5)")
        //     .attr('width',0)
        //     .transition()
        //     .duration(1000)
        //     .attr('width', map(impressions.loadedTimeRange[0],impressions.timeRange[0],impressions.timeRange[1],0,timeline.size[0]+_this.cursorWidth*2)-3)
    },

    updateLoadedWindow: function(){

        // var _this = this;
        // var w = d3.select('rect.loadedWindow');
        // if(!w[0][0]) return;
        
        // w.transition()
        //     .attr('width', Math.max(0,map(impressions.loadedTimeRange[0],impressions.timeRange[0],impressions.timeRange[1],0,timeline.size[0]+_this.cursorWidth)-2));

        // if(parseFloat(w.attr('width')) < 1){
        //     w.remove();
        // }

    },

    initSelection:function(e){
        var filter = d3.select('#timeline svg');
        this.selectionOrigin = d3.mouse(filter.node())[0];
        this.selection = filter.append('rect')
            .classed('selection', true)
            .attr('x',this.selectionOrigin)
            .attr('y',1)
            .attr('width',0)
            .attr('height',this.h-1)
            .attr('fill','rgba(152,218,255,0.5)');
    },
    
    dragSelection:function(e){

        if(e.x-this.selectionOrigin >= 0){
            this.selection
                .attr('width',clamp((e.x-this.selectionOrigin),[0,this.w-this.selectionOrigin-1]))
        } else {
            this.selection
                .attr('x',clamp(this.selectionOrigin+(e.x-this.selectionOrigin),[1,this.w-1]))
                .attr('width',clamp(-(e.x-this.selectionOrigin),[0,this.selectionOrigin-1]));
        }

    },
    
    endSelection:function(e){

        this.selectedFilters = [];

        if(this.lastSelection) this.lastSelection.remove();
        this.selection.remove();

        var filter = d3.select('#timeline svg');
        this.lastSelection = filter.append('rect')
            .classed('selection', true)
            .attr('x',this.selectionOrigin)
            .attr('y',1)
            .attr('width',20)
            .attr('height',this.h-1)
            .attr('fill','rgba(152,218,255,0.3)');

        var x = d3.mouse(filter.node())[0];
        if(x-this.selectionOrigin >= 0){
            this.lastSelection
                .attr('width',clamp((x-this.selectionOrigin),[0,this.w-this.selectionOrigin-1]))
        } else {
            this.lastSelection
                .attr('x',clamp(this.selectionOrigin+(x-this.selectionOrigin),[1,this.w-1]))
                .attr('width',clamp(-(x-this.selectionOrigin),[0,this.selectionOrigin-1]));
        }

        if(this.lastSelection.attr('width')<5){
            this.clear();
            return;
        }

        this.selectedFilters.push(this.lastSelection);
        filters.filter();

    },

    filter: function(impressionsIn){
        var impressionsOut = [];
        if(this.selectedFilters.length == 0) impressionsOut = impressionsIn;
        else {
            var filterRange = [this.timeScale.invert(this.lastSelection.attr('x')-2),this.timeScale.invert(parseFloat(this.lastSelection.attr('x'))+parseFloat(this.lastSelection.attr('width'))+4)];
            var len = impressionsIn.length;
            for(var i = 0; i<len; i++){
                var imp = impressionsIn[i];
                var t = map(imp.timestamp,impressions.timeRange[0],impressions.timeRange[1],0,1)
                if(t >= filterRange[0] && t <= filterRange[1]) impressionsOut.push(imp);
            }
        }
        return impressionsOut;
    },

    clear: function(){
        d3.select('#timeline svg rect.selection').remove();
        this.selectedFilters = [];
        filters.filter();
    }

}

AdLoader = function(){
    this.rot = [0,0.3];
    this.v = [Math.PI,Math.PI/4];
    this.running = true;
    this.movedToBottom = false;
    this.pos = new THREE.Vector3();
    this.tpos = new THREE.Vector3();
    this.offset = 0;
}

AdLoader.prototype = {

    constructor: AdLoader,

    init: function(){

        var _this = this;
        var w = 50;

        d3.select('#container')
            .append('div')
            .classed('loaderWrapper',true)
            .style('width',(w*4)+'px')
            .style('height',(w*2)+'px')
            .style('position','absolute')
            .style('top','50px')
            .style('left',(d3.select('#container').node().clientWidth)/2-(w*4)/2)
            .append('p')
                .text("Loading feed")
                .style('width',(w*4)+'px')
                .style('margin',0)
                .style('fill', '#c5c5c5')
                .style('position','absolute')
                .style('bottom',0)
                .style('opacity',0)
                .transition()
                .style('opacity',1)

        var arcConstructor = d3.svg.arc()
            .innerRadius(w/8)
            .outerRadius(w/4)
            .startAngle(0)
            .endAngle(Math.PI*1.5)
        var arcConstructor2 = d3.svg.arc()
            .innerRadius(w/8)
            .outerRadius(w/4)
            .startAngle(0)
            .endAngle(Math.PI*2)

        var svg = d3.select('div.loaderWrapper')
            .append('svg')
            .classed('loader',true)
            .style('width',w)
            .style('height',w)
            .style('position','absolute')
            .style('left',w*1.5)
            
        svg.append('path')
            .classed('arc',true)
            .attr('d', arcConstructor)
            .attr('fill','rgba(152,218,255,0.4)')
            //.attr('fill','rgba(88, 135, 253,0.4)')

        svg.append('path')
            .classed('arc',true)
            .attr('d', arcConstructor)
            .attr('fill','rgba(152,218,255,0.5)')
            //.attr('fill','rgba(88, 135, 253,0.5)')

        svg.append('path')
            .classed('arc',true)
            .attr('d', arcConstructor2)
            .attr('fill','rgba(152,218,255,0.25)')
            //.attr('fill','rgba(88, 135, 253,0.25)')
            .attr('transform', 'translate('+w/2+','+w/2+')')

        var animateArcs = function(){

            if(_this.movedToBottom){
                _this.pos.lerp(_this.tpos,0.2);
                d3.select('#container div.loaderWrapper')
                    .style('top',function(){
                        return (_this.offset + _this.pos.y) +'px';
                    });
            }   

            d3.selectAll('svg.loader path.arc')
                .filter(function(d,i){return i<2})
                .each(function(d,i){
                    _this.rot[i] += _this.v[i];
                    d3.select(this)
                        .attr('transform', 'translate('+w/2+','+w/2+') rotate(' +_this.rot[i]+')')
                })
            if(_this.running) requestAnimationFrame(animateArcs);
        }
        animateArcs();

    },

    remove: function(){
        this.running = false;

        d3.select('div.loaderWrapper')
            .transition()
            .style('opacity',0)
            .each('end',function(){
                d3.select(this)
                    .style('display','none');
            })

    },

    moveToBottom: function(){

        var _this = this;
        
        this.movedToBottom = true;
        if(this.running){
            d3.select('#container div.loaderWrapper')
                .style('pointer-events','none')
                .transition()
                .style('opacity',0)
                .each('end',function(){
                    d3.select(this).select('p')
                        .style('display','none')
                    d3.select(this)
                        .transition()
                        .style('opacity',1);
                    _this.tpos = new THREE.Vector3();
                    _this.pos = new THREE.Vector3();
                    var colYs = grid.colYs.slice(7,9);
                    _this.offset = (Math.max.apply(null, colYs) + 50) + grid.tpos.y;
                })
        }
            
    }

}

TimelineTicks = function(){

    this.values = [];
    this.active = false;
    this.svg = d3.select('#container').append('svg')
        .attr('width',width)
        .attr('height',height)
        .classed('ticks',true)
    this.timeFormat = d3.time.format("%m/%d/%y");
    this.scrollOffset = 0;
}


TimelineTicks.prototype = {

    constructor: TimelineTicks,

    init: function(){

        var _this = this;

        this.hourOffset = new Date(impressions.timeRange[1]*1000).getHours();
        this.values = [];
        for(var i=0; i<Math.ceil((width/9+this.hourOffset)/24); i++){
            var tickDate = new Date(impressions.timeRange[1]*1000 - i*(1000*3600*24));
            tickDate.setMinutes(0);
            tickDate.setSeconds(0);
            tickDate.setMilliseconds(0);
            this.values.push(tickDate);
        }

        this.update();

        this.active = true;

    },

    update: function(){

        var _this = this;

        for(var i=this.values.length; i<Math.ceil((grid.colXs+_this.hourOffset)/24); i++){
            var tickDate = new Date(impressions.timeRange[1]*1000 - i*(1000*3600*24));
            tickDate.setMinutes(0);
            tickDate.setSeconds(0);
            tickDate.setMilliseconds(0);
            this.values.push(tickDate);
        }

        d3.select('svg.ticks').selectAll('g.tick')
            .data(this.values)
            .enter()
            .append('g')
            .classed('tick',true)
            .attr('transform',function(d,i){return 'translate(' + (_this.scrollOffset + width-(i*24+_this.hourOffset)*9-7) + ',0)' })
            .attr('opacity',0)
            .each(function(d,i){
                d3.select(this)
                    .append('line')
                    .attr('y1',8)
                    .attr('y2',height-180)
                    .attr('stroke','#555')
                    
                d3.select(this)
                    .append('text')
                    .classed('date',true)
                    .attr('x',5)
                    .attr('y',height-182)
                    .text( function(d) { return _this.timeFormat(d); })
                    .attr("font-family", "knockout")
                    .attr('letter-spacing', '0.05em')
                    .attr("font-size", "11px")
                    .attr("fill", "#d5d5d5")	// $$$ COLOR
                    .style('text-anchor', 'start');
            })
            .transition()
            .attr('opacity',1);

    },

    kill: function(){
        d3.select('svg.ticks').selectAll('g.tick').remove();
        this.active = false;
    },

}

AdCounters = function(){

    var _this = this;

    this.w = width/10;

    var left = parseFloat(window.getComputedStyle(document.getElementById('filters')).width.split("px")[0])/10;

    d3.select('#filters').append('div')
        .classed('counters',true)
        .style('position','absolute')
        .style('top', '0')
        .style('left',(left-this.w-12) +'px')
        .style('width',this.w+'px')
        .style('height',this.w+'px')

    this.offset = 0;

}

AdCounters.prototype = {
    constructor: AdCounters,

    init: function(){
        d3.select('div.counters').html('<p class="counter collected" id="ad-number">0</p><p class="label" id="ad-label">total</p><p class="counter loaded" id="ad-number">0</p><p class="label" id="ad-label">loaded</p><p class="counter filteredCounter">0</p><p class="label filteredCounter">filtered</p>')
        d3.selectAll('div.counters p.filteredCounter')
            .style('opacity',0);
    },

    update: function(){

        d3.select('div.counters p.collected')
            .text(impressions.all.length-this.offset);

        d3.select('div.counters p.loaded')
            .text(impressions.loadedPool.length-this.offset);

        var filtered = 0;
        var len = impressions.loadedPool.length;
        for(var i = 0; i<len; i++){
            if(impressions.loadedPool[i].filtered && !impressions.loadedPool[i].removed) {
                filtered ++;
            }
        }

        var _this = this;
        d3.selectAll('div.counters p.filteredCounter')
            .transition()
            .style('opacity',filtered!=impressions.loadedPool.length-_this.offset ? 1:0)
            .each('end',function(){
                if(d3.select(this).text() != 'filtered') d3.select(this).text(filtered - _this.offset)
            })

    }
}



///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
// tagging module - dirty but functional
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////


var untaggedAds = [],
    taggingImp,
    currentCategory = {},
    currentImg = {},
    tagManager;


function tagAd(impression) {
    taggingImp = impression;
    if(!optIn) return;

    d3.select('#taggingBody')
        .style('display','block')
        .style('opacity',0)
        .transition()
        .style('opacity',1)

    tagManager = new TagManager();
    tagManager.path = [];
        
    currentImg = new Image();
    currentImg = impression.placement.texture.image;
    
    d3.select('#imageToTag img')
        .attr('src',currentImg.src);
    tagManager.init();
    initStatus();
}

function initStatus(){

    d3.selectAll('#statusBar div.btn')
        .on('mouseout',function(){updateStatus()});

    d3.select('#statusBar div.back')
        .on('click',function(){
            tagManager.popLevel(tagManager)
        })
        .on('mouseover',function(){
            d3.select('#statusBar div.status p')
                .text('Back to previous tag');
        });

    d3.select('#statusBar div.done')
        .on('click',function(){
            tagManager.confirm();
        })
        .on('mouseover',function(){
            d3.select('#statusBar div.status p')
                .text('Confirm selected tag.');
        });

    d3.select('#statusBar div.skip')
        .on('click',function(){
            tagManager.skip(false);
        })
        .on('mouseover',function(){
            d3.select('#statusBar div.status p')
                .text('Tag this ad later.');
        });

    d3.select('#statusBar div.flagButton')
        .on('click',function(){
            tagManager.skip(true);
        })
        .on('mouseover',function(){
            d3.select('#statusBar div.status p')
                .text('This is not an ad.');
        });

}

function updateStatus(){
    if(tagManager.path.length == 0){

        d3.select('#statusBar div.status p')
            .text('Select a tag from the tree below to categorize this ad.')

        d3.select('#statusBar div.back')
            .transition()
            .style('max-width','0');

        d3.select('#statusBar div.done')
            .transition()
            .style('max-width','0');

    } else {
        d3.select('#statusBar div.status p')
            .text('Selected \'' + tagManager.path[tagManager.path.length-1] + '\'');

        d3.select('#statusBar div.back')
            .transition()
            .style('max-width','50px');

        d3.select('#statusBar div.done')
            .transition()
            .style('max-width','50px');
    }

    d3.select('#statusBar div.done')
            .style('background-color','rgba(152,218,255,0)')
}


var loadImpressions = function loadImpressions(){
    if(impressions.loading) {
        impressions.load();
    }
    requestAnimationFrame(loadImpressions);
}

TagManager = function(){

    this.container = d3.select('#tagging div.horizontalPan');
    this.container.append('div')
        .classed('level',true);
    this.tags = keywords.topLevel;
    this.path = [];
    this.offset = 0;

}

TagManager.prototype = {

    constructor: TagManager,

    init: function(){

        var _this = this;
        this.path = [];

        d3.select('#tagging')
            .style('opacity',0)
            .transition()
            .style('opacity',1);

        this.sortTags(this.tags);

        d3.select('#tagging div.horizontalPan div.level').selectAll('div.tag')
            .data(this.tags)
            .enter()
            .append('div')
            .classed('tag',true)
            .text(function(d,i){return d.name})
            .on('click',function(){_this.onClick(d3.select(this))})
            .on('mouseover',function(){_this.onMouseOver(d3.select(this))})
            .on('mouseout',function(){_this.onMouseOut(d3.select(this))})
            .style('cursor','pointer')
            .style('opacity',0)
            .transition()
            .style('opacity',1);

        return this;
    },

    addLevel: function(source){

        var _this = this;
        var level = source.datum().level;

        this.path[level] = source.datum().name;
        while(this.path.length > level+1) this.path.pop();

        this.sortTags(source.datum().children);

        for(var i = level+2; i<=this.container.node().children.length; i++){
            d3.select('#tagging div.horizontalPan div.level:nth-child('+ (i) +')').selectAll('div.tag')
                .style('background-color','rgba(152,218,255,0)')
            d3.select('#tagging div.horizontalPan div.level:nth-child('+ (i) +')').remove();
        }

        for(var i = level+1; i<=this.container.node().children.length; i++){
            d3.select('#tagging div.horizontalPan div.level:nth-child('+ (i) +')').selectAll('div.tag')
                .filter(function(){return this != source.node();})
                .style('background-color','rgba(152,218,255,0)')
        }

        if(this.container.node().children.length <= level+1){
            var d = d3.select('#tagging div.horizontalPan')
                .append('div')
                .classed('level',true)
        }

        d3.select('#tagging div.horizontalPan div.level:nth-child('+ (level+1) +')').selectAll('div.tag')
            .each(function(d,i){
                if(_this.path[level] != d.name) _this.onMouseOut(d3.select(this));
            })        

        d3.select('#tagging div.horizontalPan div.level:nth-child('+ (level+2) +')').selectAll('div.tag')
            .data(source.datum().children)
            .enter()
            .append('div')
            .classed('tag',true)
            .on('click',function(){_this.onClick(d3.select(this))})
            .on('mouseover',function(){_this.onMouseOver(d3.select(this))})
            .on('mouseout',function(){_this.onMouseOut(d3.select(this))})
            .style('cursor','pointer')
            .style('opacity',0)
            .transition()
            .style('opacity',1);

        d3.select('#tagging div.horizontalPan div.level:nth-child('+ (level+2) +')').selectAll('div.tag')
            .text(function(d,i){return d.name})


        this.translate(source);

        this.updateStatus();

    },

    popLevel: function(_this){

        if(_this.container.node().children.length-1 <= _this.path.length){
            d3.selectAll('#tagging div.horizontalPan div.level').selectAll('div.tag')
                .filter(function(d,i){return d.name == _this.path[_this.path.length-1]})
                .transition()
                .style('background-color','rgba(152,218,255,0)')
            _this.path.pop();
        }
        if(_this.path.length == 0) {
            d3.select('#statusBar div.back')
                .transition()
                .style('max-width',0);
            d3.select('#statusBar div.done')
                .transition()
                .style('max-width',0);
            // return;
        }

        if(_this.container.node().children.length > 1) d3.selectAll('#tagging div.horizontalPan div.level:last-child').remove();

        this.translate(d3.select('#tagging div.horizontalPan div.level:nth-child('+ (_this.path.length) +')').selectAll('div.tag'));
    },

    updateStatus: function(){
        d3.select('#statusBar div.status p')
            .text('Selected \'' + tagManager.path[tagManager.path.length-1] + '\'. Click again to confirm.');

        d3.select('#statusBar div.back')
            .transition()
            .style('max-width','50px');

        d3.select('#statusBar div.done')
            .transition()
            .style('max-width','50px');

        d3.select('#statusBar div.done')
            .style('background-color','rgba(152,218,255,0.3)')
    },

    sortTags: function(tags){
        tags.sort(function(a,b){return b.score-a.score})
    },

    translate: function(source){

        var level = d3.selectAll('div.level')[0].length;

        var cw = d3.select('#statusBar').style('width');
        cw = parseFloat(cw.substring(0,cw.length-2));

        var w = 0;
        var lw = 0;
        for(var i = 0; i < level; i++){
            var lw = d3.select('#tagging div.horizontalPan div.level:nth-child('+ (i+1) +')').style('width');
            lw = parseFloat(lw.substring(0,lw.length-2))+20;
            w += lw;
        }

        w -= 10;

        this.offset = 0;
        if(cw - this.offset < w) {
            this.offset = (cw + this.offset) - w;
        }

        d3.select('#tagging div.horizontalPan')
                .style('left',this.offset);

    },

    confirm: function(){

        d3.select('#taggingBody')
            .transition()
            .style('opacity',0)
            .each('end',function(){
                d3.select(this).style('display','none')
            })

        taggingImp.keywords = [];
        for(var i=this.path.length-1; i>=0; i--){
            taggingImp.keywords.push(keywords.ids[this.path[i]]);
        }

        this.sendTag();
        taggingImp.unfocus();

    },

    skip: function(notAnAd){

        if(notAnAd){
            chrome.extension.sendMessage( { "whatKind": "flagAd", "placement_id" : taggingImp.placement_id, "reason" : "false_positive" }, function(status, error){
                if(error) {
                    displayError('flagAdFromModule',error);
                    return;
                }
            });
        }

        d3.select('#taggingBody')
            .transition()
            .style('opacity',0)
            .each('end',function(){
                d3.select(this).style('display','none')
            })

        taggingImp.unfocus();

    },

    sendTag: function(){
        chrome.extension.sendMessage( { "whatKind": "tagPlacement", "tag_id": keywords.ids[this.path[this.path.length-1]], "placement_id" : taggingImp.placement_id }, function(status, error){
            if(error) {
                displayError('tagPlacement',error);
                return;
            }
        });

    },

    onClick: function(source){
        var level = source.datum().level;
        if(this.path[this.path.length-1] != source.datum().name) this.addLevel(source);
        else {
            this.confirm();
            source.style('background-color','rgba(255,255,255,1)')
        }
    },

    onMouseOver: function(source){
        source
            .style('background-color','rgba(152,218,255,0.9)')
            .style('opacity',1)

        if(source.datum().name == this.path[this.path.length-1]) this.updateStatus();
        else updateStatus();
    },

    onMouseOut: function(source){
        var level = source.datum().level;
        source
            .transition()
            .duration(150)
            .style('background-color','rgba(152,218,255,' + (this.path[level] == source.datum().name ? 0.3 : 0.0) + ')')
        updateStatus();
    }


}


// $('#demographics').validate({
//         onkeyup: false,
//         rules: {
//            age: {
//              number: true,
//              min: 13,
//              max: 120
//            }
//         },
//         messages: {
//           age: {
//             number: "Age must be numerical",
//             min: "Sorry, the minimum age to use Floodwatch is 13",
//             max: "Unless you're the world's oldest person, you're not entering a valid age!"
//           }
//       },
//       submitHandler: function() {
//         var demo = $('#demographics').serializeJSON();
//         chrome.extension.sendMessage({'whatKind': 'updateDemo', 'demo' : demo});
//       }
//     });


DropdownMenu = function(){

    var _this = this;
    this.hidden = true;

    this.dom = d3.select('#dropdownMenu');
    this.h = this.dom
        .style('display','block')
        .node().clientWidth;
        // .each(function(){
        //     return d3.select(this)node().clientHeight;
    requestAnimationFrame(function(){
        _this.h = d3.select('#dropdownMenu')
            .node().clientHeight;

        d3.select('#dropdownMenu')
            .style('bottom',-_this.h+'px')
            .transition()
            .style('bottom',55-_this.h+'px');

        d3.select('#dropdownMenu div.hitbox')
            .on('mouseover',function(){
                _this.toggle();
            })
            // .on('mouseout',function(){
            //     _this.hide();
            // });
    })
}

DropdownMenu.prototype = {

    constructor: DropdownMenu,

    init: function(){

        d3.selectAll('#dropdownMenu .form')
            .style('display',function(d,i){
                return optIn ? (i==0?'none':'block') : (i==1?'none':'block');
            });

        d3.select('#dropdownMenu p.cta')
            .text(optIn ? 'Please consider helping privacy researchers by donating some demographic information.' : 'Floodwatch works better if you share your ads with our researchers. Please consider donating your information!');
        
        d3.select('#dropdownMenu div.optin span')
            .on('click',function(){
                toggleAbout(true);
                d3.selectAll('div.nav div')
                    .classed('current',false)
                    .filter(function(d,i){return d3.select(this).text() == 'About'})
                    .classed('current',true);
                requestAnimationFrame(function(){
                    d3.select('#about')
                        .transition()
                        .delay(300)
                        .each('end',function(){
                            d3.transition()
                                .duration(700)
                                .tween("scrollT", scrollTween(d3.select(this).select('div.donate').node().offsetTop, this));
                            function scrollTween(offset, target) {
                                if (verbose) console.log(target);
                                return function() {
                                    var i = d3.interpolateNumber(target.scrollTop, offset)
                                    return function(t) { target.scrollTop = i(t); };
                                }
                            }
                        });                                
                });
            })

        var _this = this;
        var removeOverTime = function(){
            window.setTimeout(function(){
                if(_this.hidden) _this.remove();
                else removeOverTime();
            },60000);
        }
        removeOverTime();

        return this;
    },

    toggle: function(){
        if(this.hidden){

            var h = window.innerHeight;
            d3.select('#dropdownMenu div.hitbox')
                .style('height',h+'px')
                .style('top',-h+'px');

            d3.select('#dropdownMenu')
                .transition()
                .style('bottom','0')
                .each('end',function(){
                    d3.select(this).selectAll('.cta')
                        .style('pointer-events','auto')
                })
            
            d3.selectAll('#dropdownMenu p.cta, #dropdownMenu p.icon')
                .transition()
                .style('margin-top',function(d,i){return  i==0?'10px':'7px'});

        } else {
            d3.select('#dropdownMenu div.hitbox')
                .style('height',this.h+'px')
                .style('top',0);

            d3.select('#dropdownMenu')
                .transition()
                .style('bottom',55-this.h+'px')
                .selectAll('.cta')
                    .style('pointer-events','none')

            d3.selectAll('#dropdownMenu p.cta, #dropdownMenu p.icon')
                .transition()
                .style('margin-top',0);
        }
        this.hidden = !this.hidden;
    },

    remove: function(){
        d3.select('#dropdownMenu div.hitbox')
                .style('display','none')

        d3.select('#dropdownMenu')
            .transition()
            .style('bottom',-this.h+'px')
            .each('end',function(){
                d3.select(this).remove();
            })
    }

}


function setVisibility(id, visibility) {
				document.getElementById(id).style.display = visibility;
			}
			
			
			



