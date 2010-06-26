'use strict';

/*!
* The Revolutionaries
*   dharmfly.com/revolutionaries
*   github.com/premasagar/revolutionaries
*
*//*
    JavaScript by @premasagar

    license
        opensource.org/licenses/mit-license.php
        
    v0.1

*/

var revolutionaries = (function(){

    var monitorFreq = 250, // miiliseconds
        slugHistoryCache = [],
        slugCurrent = -1,
        window = this,
        jQuery = window.jQuery,
        _ = window._,
        tmpl,
        api;
    
    
    // CACHE
    
    // localStorage wrapper
    function cache(key, value){
        var ns = 'revolutionaries',
            localStorage = window.localStorage,
            JSON = window.JSON;
        
        if (!localStorage || !JSON){
            _(!!localStorage, !!JSON);
            return false;
        }
        key = ns + '.' + key;
        if (typeof value === 'undefined'){
            value = localStorage[key];
            return value ? JSON.parse(value).v : value;
        }
        else {
            localStorage[key] = JSON.stringify({
                v: value,
                t: new Date().getTime()
            });
        }
    }
    
    // Caching layer for JSONP data
    // TODO: add check for error responses, or mechanism for deleting keys
    function jsonCache(url, callback){
        var cached = cache(url);
        if (cached){
            callback(cached);
        }
        else {
            jQuery.getJSON(url, function(data){
                cache(url, data);
                callback(data);
            });
        }
    }
        
        
    // YQL & SPARQL    
    
    function yqlUrl(query){
        return 'http://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(query) + '&format=json&callback=?';
    }
    
    function yql(query, callback, cache){
        var url = yqlUrl(query),
            method = cache ? jsonCache : jQuery.getJSON;
            
        method.call(null, url, function(data){
            callback(data && data.query && data.query.results ? data.query.results : {});
        });        
    }
    
    function dbpediaQuery(sparql){
        return 'http://dbpedia.org/sparql?query=' + encodeURIComponent(sparql) + '&format=json';
    }
    
    function yqlSparqlQuery(sparql){
        return "select results from json where url='" + dbpediaQuery(sparql) + "'";
    }
    
    function yqlMulti(queries){ // NOTE: queries should use single quotes around values like urls
        return yqlUrl('select * from query.multi where queries="' + queries.join(';') + '"');
    }
    
    function dbpediaSparql(sparql, callback){
        var query = yqlSparqlQuery(sparql);
        yql(query, function(data){
            callback(data && data.json && data.json.results && data.json.results.bindings ? data.json.results.bindings : data);
        }, true);
    }
    

    // WIKIPEDIA / DBPEDIA
    
    function wikipedia(name, callback){
        var query = "select url from search.web where query=\"site:en.wikipedia.org/wiki/ '" + name + "'\" LIMIT 1";
        yql(query, function(data){
            callback(data ? data.result.url : false);
        }, true);
    }
    
    function dbpediaUrl(url){
        var dbBase = 'http://dbpedia.org/resource/',
            wikiBase = 'http://en.wikipedia.org/wiki/';
            
        url = jQuery.trim(url);        
        if (url.indexOf(wikiBase) === 0){
            return url.replace(wikiBase, dbBase);
        }
        return dbBase + url;
    }
    
    function wikipediaUrl(url){
        var dbBase = 'http://dbpedia.org/resource/',
            wikiBase = 'http://en.wikipedia.org/wiki/';
            
        url = jQuery.trim(url);        
        if (url.indexOf(dbBase) === 0){
             return url.replace(dbBase, wikiBase);
        }
        return wikiBase + url;
    }
    
    function urlSlug(url){
        return jQuery.trim(url).replace(/^.*\/(.*)\/?$/, '$1');
    }
    
    function slugToId(slug){
        return slug
            .toLowerCase()
            .replace(/[_ ]/g, '-')
            .replace(/[^a-z\-]/g, '');
    }
    
    function urlToId(url){
        return slugToId(urlSlug(url));
    }
    
    function wikimediaAlternative(src){
        return src.replace('/en/', '/commons/');
    }
    
    function wikimediaSize(src, size){
        return src.replace(/\d+px/, size + 'px');
    }
    
    function cleanupName(name){
        return name.replace(/ \([^\)]*\)/, '');
    }    
    
    
    // MEDIA
    
    function loadPhoto(src, alt, callback){
        if (src){
            var img;
            
            img = jQuery('<img class="photo" src="' + src + '" alt="' + (alt || '') + '">')[0];
            img.onload = function(){
                callback.call(this, true);
            };
            img.onerror = function(){
                callback.call(this, false);
            };
        }
    }
    
    
    // SPARQL QUERIES - sparql by @tommorris
    
    function person(dbpediaUrl, callback){
        var thumbSize = 100;
    
        return dbpediaSparql(
            'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?name, ?depiction, ?thumbnail, ?influences, ?abstract WHERE { <' + dbpediaUrl + '> rdfs:label ?name; foaf:depiction ?depiction ; <http://dbpedia.org/ontology/thumbnail> ?thumbnail; <http://dbpedia.org/ontology/abstract> ?abstract. FILTER langMatches( lang(?name), "EN" ) . FILTER langMatches( lang(?abstract), "EN" ) . }',
            
            function(data){
                callback({
                    type: 'person-detail',
                    id: urlToId(dbpediaUrl),
                    url: wikipediaUrl(dbpediaUrl),
                    dbUrl: dbpediaUrl,
                    name: data.name ? cleanupName(data.name.value) : '',
                    depiction: data.depiction ? data.depiction.value : '',
                    thumbnail: data.thumbnail ? wikimediaSize(data.thumbnail.value, thumbSize) : '',
                    abstract: data.abstract ? data.abstract.value : ''
                });
            }
        );
    }
    
    // Those who have been influences for the person (i.e. those who have influenced the person)
    function influences(dbpediaUrl, callback, options){
        return dbpediaSparql(
            'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?influenced, ?name WHERE { ?influenced <http://dbpedia.org/property/influenced> <' + dbpediaUrl + '> . OPTIONAL { ?influenced foaf:name ?name . } FILTER langMatches( lang(?name), "EN" ) . }',
            
            function(items){
                var urls = {};
                items = jQuery.map(items, function(data, i){
                    var url = data.influenced.value;
                    if (!urls[url]){
                        urls[url] = true;
                        return data;
                    }
                });
            
                jQuery.each(items, function(i, data){
                    items[i] = {
                        type: 'person-summary',
                        dbUrl: data.influenced.value,
                        url: wikipediaUrl(data.influenced.value),
                        id: urlToId(data.influenced.value),
                        name: data.name ? cleanupName(data.name.value) : '',
                        depiction: data.depiction ? data.depiction.value : '',
                        thumbnail: data.thumbnail ? data.thumbnail.value : '',
                        abstract: data.abstract ? data.abstract.value : ''
                    };
                });
                callback(items);
            }
        );
    }
    
    // Those who have been influenced by the person (i.e. those who the person has been an influence)
    function influenced(dbpediaUrl, callback){
        return dbpediaSparql(
            'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT DISTINCT ?influence, ?name WHERE { ?influence <http://dbpedia.org/property/influences> <' + dbpediaUrl + '> . OPTIONAL { ?influence foaf:name ?name . } FILTER langMatches( lang(?name), "EN" ) . }',
            
            function(items){
                var urls = {};
                items = jQuery.map(items, function(data, i){
                    var url = data.influence.value;
                    if (!urls[url]){
                        urls[url] = true;
                        return data;
                    }
                });
            
                jQuery.each(items, function(i, data){
                    items[i] = {
                        type: 'person-summary',
                        dbUrl: data.influence.value,
                        url: wikipediaUrl(data.influence.value),
                        id: urlToId(data.influence.value),
                        name: data.name ? cleanupName(data.name.value) : '',
                        depiction: data.depiction ? data.depiction.value : '',
                        thumbnail: data.thumbnail ? data.thumbnail.value : '',
                        abstract: data.abstract ? data.abstract.value : ''
                    };
                });
                callback(items);
            }
        );
    }
    
    
    // PROSE
    
    // split a string into sentences
    function sentences(txt, spliceStart, spliceEnd){
        spliceStart = spliceStart || 0;
    
        var delim = '@@R@E@V@O~L~U~T~I~O@N@A@R@Y@',
            s = jQuery.trim(txt)
                .replace(/\.\s+/g, '.' + delim)
                .split(delim),
            len = s.length;

        s[len-1].replace(/(?!\.)$/, '.');
        spliceEnd = typeof spliceEnd === 'number' ? spliceEnd : len;
        return s.slice(spliceStart, spliceEnd);
    }

    // select a number of sentences from a paragraph
    /* e.g.
        paragraph('mary had. a little lamb. its fleecy as white as snowy. white and the seven', 1, 3);
    */
    function paragraph(txtOrSentences, spliceStart, spliceEnd){
        if (typeof txtOrSentences === 'string'){
            return paragraph(sentences(txtOrSentences, spliceStart, spliceEnd));
        }
        else {
            return txtOrSentences
                .join(' ');
        }
    }
    
    
    
    // WINDOW.LOCATION && DB/WIKIPEDIA SLUGS
    // TODO: This is implemented a little haphazardly. Could do with refactoring.
        
    function triggerSlugChange(slug){
        jQuery(window).trigger('slugchange', slug);
    }
    
    function slugHistory(index){
        if (jQuery.isArray(index)){
            return slugHistoryCache;
        }
        if (typeof index !== 'number'){
            index = slugCurrent;
        }
        return index === -1 ?
            slugHistoryCache[slugHistoryCache.length - 1] :
            slugHistoryCache[index];
    }
    
    function currentSlug(newSlug, trigger){
        var index;
        
        if (typeof newSlug === 'undefined'){
            return window.location.hash.slice(1);
        }
        if (typeof newSlug === 'number'){
            index = newSlug;
            newSlug = slugHistory(index);
            if (newSlug){
               slugCurrent = index;
            }
            else {
                return;
            }
        }
        else if (typeof newSlug === 'string' && newSlug !== slugHistory()){
            if (slugCurrent !== -1 && slugCurrent !== (slugHistoryCache.length -1)){
                slugHistoryCache = slugHistoryCache.slice(0, slugCurrent + 1);
            }
            slugHistoryCache.push(newSlug);
            slugCurrent = -1;
        }
        window.location.hash = '#' + newSlug;
        if (trigger !== false){
            triggerSlugChange(newSlug);
        }        
    }
    
    function isPrev(){
        return slugCurrent === -1 ?
            slugHistoryCache.length > 1 :
            !!slugCurrent;
    }
        
    function isNext(){
        return slugCurrent !== -1 && slugCurrent < slugHistoryCache.length - 1;
    }
    
    function prevSlug(){
        var last = slugHistoryCache.length - 1,
            newIndex = slugCurrent;
            
        if (isPrev()){
            newIndex = (slugCurrent === - 1 ? last : slugCurrent) - 1;
            currentSlug(newIndex);
        }
    }
    
    function nextSlug(){
        if (isNext()){
            slugCurrent = slugCurrent + 1;
            currentSlug(slugCurrent);
        }
    }
    
    function monitorSlug(){
        function detectSlugChange(){
            var slug = currentSlug();
            if (slug && slugHistory() !== slug){
                currentSlug(slug.replace(/[+ ]/, '_'));
            }
        }
        detectSlugChange();
        window.setInterval(detectSlugChange, monitorFreq);
    }
    
    
    // MICRO-TEMPLATING
    
    // Tmpl, by John Resig - http://ejohn.org/ - MIT Licensed
    // Modified as per Neil on Rick Stahl's blog http://www.west-wind.com/Weblog/posts/509108.aspx#532836
    tmpl = (function() {
        var cache = {},
        tmpl = function tmpl(str, data) {
            // Figure out if we're getting a template, or if we need to
            // load the template - and be sure to cache the result.
            var fn = !/\W/.test(str) ?
                cache[str] = cache[str] ||
                    tmpl(document.getElementById(str).innerHTML) :

                // Generate a reusable function that will serve as a template
                // generator (and which will be cached).
                new Function("obj",
                "var p=[],print=function(){p.push.apply(p,arguments);};" +

                // Introduce the data as local variables using with(){}
                "with(obj){p.push('" +

                // Convert the template into pure JavaScript
                str.replace(/[\r\t\n]/g, " ")
                   .replace(/'(?=[^%]*%>)/g,"\t")
                   .split("'").join("\\'")
                   .split("\t").join("'")
                   .replace(/<%=(.+?)%>/g, "',$1,'")
                   .split("<%").join("');")
                   .split("%>").join("p.push('") +
                   "');}return p.join('');");
            
            // Provide some basic currying to the user
            return data ? fn(data) : fn;
        };
        return tmpl;
    }());
    
    
    // REVOLUTIONARIES API
    // TODO: Consolidate these methods, renaming, refactoring.
    
    api = {
        slug: function(slug, callback){
            api.person(dbpediaUrl(slug), callback);
        },
    
        keyword: function(keyword, callback){
            wikipedia(keyword, function(url){
                if (url){
                    api.person(dbpediaUrl(url), callback);
                }
                else {
                    callback(false);
                }
            });
        },
        
        person: function(url, callback){        
            if (url){
                person(url, function(item){
                    item.type = 'revolutionary';
                    callback(item);
                });
                
                influences(url, function(items){
                    jQuery.each(items, function(i, item){
                        person(item.dbUrl, function(item){
                            item.type = 'influence';
                            callback(item);
                        });
                    });
                });
                
                influenced(url, function(items){
                    jQuery.each(items, function(i, item){
                        person(item.dbUrl, function(item){
                            item.type = 'influenced';
                            callback(item);
                        });
                    });
                });
            }
        },
        
        init: function(slug){
            if (slug){
                currentSlug(slug);
            }
            monitorSlug();
        },
        
        cache: cache,
        jsonCache: jsonCache,
        tmpl: tmpl,
        loadPhoto: loadPhoto,
        wikimediaAlternative: wikimediaAlternative,
        currentSlug: currentSlug,
        slugHistory: slugHistory,
        prevSlug: prevSlug,
        nextSlug: nextSlug,
        isPrev: isPrev,
        isNext: isNext,
        dbpediaUrl: dbpediaUrl,
        wikipediaUrl: wikipediaUrl,
        urlSlug: urlSlug,
        paragraph: paragraph,
        sentences: sentences
    };
        
    return api;
}());


//////////////////////////////////

// DISPLAY
// TODO: Some of this is implemented in a bit of a haphazard way. Could do with a smoother logical flow.

(function(){
    var api = revolutionaries,
        window = this,
        jQuery = window.jQuery,
        _ = window._,
        win = jQuery(window),
        body = jQuery('body'),
        side = jQuery('#sidebar'),
        content = jQuery('#content'),
        revolutionary = jQuery('#revolutionary'),
        related = jQuery('#related'),
        s = jQuery('.search', side),
        prev = jQuery('.history .previous', side),
        next = jQuery('.history .next', side),
        report = jQuery('.report', side),
        about = jQuery('.about', content),
        tmpl = revolutionaries.tmpl,
        influences, influencesList, influenced, influencedList;
        
    
    // sidebar height
    function resetSidebarHeight(){
        var wh = win.height(),
            bh = body.height(),
            ch = content.height();
        
        side.height(Math.max(wh, bh, ch));
    }
    
    // reset DOM
    function clear(){
        revolutionary.empty();
        related.empty();
        influences = null;    
        influenced = null;
        resetSidebarHeight();
    }
    
    function insertImg(img, id, container){
        container = container || body;      
        jQuery(img).appendTo('.' + id + ' .photo-container', container);
        resetSidebarHeight();
    }
    
    function loadPhoto(data, callback, large){
        api.loadPhoto(
            large ? data.depiction : data.thumbnail,
            data.name,
            function(success){
                if (success){
                    callback(this);
                }
                else { // try alternative src - TODO: clean this logic up
                    api.loadPhoto(
                        api.wikimediaAlternative(data.thumbnail),
                        data.name,
                        function(success){
                            if (success){
                                callback(this);
                            }
                        }
                    );
                }
            }
        );
    }
    
    function summary(abstract, spliceStart, spliceEnd){
        return tmpl('abstractParaTmpl', {
            paragraph: api.paragraph(abstract, spliceStart, spliceEnd)
        });
    }
    
    // navigation
    function showhideNav(){
        if (api.isPrev()){
            prev.show();
        }
        else {
            prev.hide();
        }
        if (api.isNext()){
            next.show();
        }
        else {
            next.hide();
        }
        
        jQuery('#revolutionary .history .previous')
            .replaceWith(prev.clone(true));            
        
        jQuery('#revolutionary .history .next')
            .replaceWith(next.clone(true));
            
        s.val(s.attr('title'));
    }
    
    // update display
    function display(data){
        var type = data ? data.type : false,
            item, abstract, moreless;
    
        // Route data to micro-templates
        switch(type){
            // main subject
            case 'revolutionary':
                if (!type || !data.name){
                    report.text('Sorry. No results...');
                    return false;
                }
                
                about.hide();
                api.currentSlug(api.urlSlug(data.dbUrl), false);
                moreless = jQuery(tmpl('abstractMoreLessTmpl', {moreless: 'More >'}))
                    .toggle(
                        function(){
                            jQuery('.moreless', abstract)
                                .text('< Less');
                            jQuery(summary(data.abstract, 1))
                                .hide()
                                .appendTo('.abstract')
                                .slideDown('fast');
                        },
                        function(){
                            jQuery('.moreless', abstract)
                                .text('More >');
                            jQuery('.abstract p:not(:first)')
                                .slideUp('fast', function(){
                                    jQuery(this).remove();
                                });
                        }
                    );
            
                clear();
                report.css('visibility', 'hidden');
                revolutionary.html(tmpl('itemDetailTmpl', jQuery.extend({}, data, {abstract:summary(data.abstract, 0, 1)})));
                
                if (api.sentences(data.abstract).length > 1){
                    jQuery('.abstract p:last', revolutionary)
                        .append(moreless);
                }
                    
                loadPhoto(data, function(img){
                    insertImg(img, data.id, revolutionary);
                }, true);
                
                showhideNav(); 
            break;
            
            
            // influences
            case 'influence':
                if (!type){
                    return false;
                }
                loadPhoto(data, function(img){
                    if (!influences){
                        influences = jQuery(tmpl('itemsTmpl', {type:type, title:'Was influenced by...'}));
                        if (influenced){
                            influences.insertBefore(influenced);
                        }
                        else {
                            influences.appendTo(related);
                        }
                        influencesList = influences.find('ul');
                    }
                    item = jQuery(tmpl('itemTmpl', {id:data.id, item:tmpl('itemSummaryTmpl', data)}));
                    item.find('a').click(function(){
                        api.person(data.dbUrl, function(data){
                            display(data);
                        });
                        return false;
                    });
                    influencesList.append(item);
                    insertImg(img, data.id, related);
                });
            break;
            
            
            // influenced
            case 'influenced':
                if (!type){
                    return false;
                }
                loadPhoto(data, function(img){
                    if (!influenced){
                        influenced = jQuery(tmpl('itemsTmpl', {type:type, title:'Has been an influence to...'}))
                            .appendTo(related);
                        influencedList = influenced.find('ul');
                    }
                    item = jQuery(tmpl('itemTmpl', {id:data.id, item:tmpl('itemSummaryTmpl', data)}));
                    item.find('a').click(function(){
                        api.person(data.dbUrl, function(data){
                            display(data);
                        });
                        return false;
                    });
                    influencedList.append(item);
                    insertImg(img, data.id, related);
                });
            break;
        }
               
        resetSidebarHeight();
    }
    
    // search box behaviour
    s.focus(function(){
        s.val('');
    })
    .blur(function(){
        var val = s.val();
        s.val(val ? val : s.attr('title'));
    })
    .parent('form').submit(function(){
        report
            .css('visibility', 'visible')
            .text('Loading...');
        api.keyword(s.val(), display);
        return false;
    });
    
    jQuery(window).bind('slugchange', function(ev, slug){
        report
            .css('visibility', 'visible')
            .text('Loading...');
        api.slug(slug, display);
    });   
    
        
    prev.click(function(){
        api.prevSlug();
    });
    next.click(function(){
        api.nextSlug();
    });
    
    // initialise
    if (!api.currentSlug()){
        about.show();
    }
    resetSidebarHeight();
    api.init();
}());
