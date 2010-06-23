/* Revolutionaries: http://dharmfly.com/revolutionaries */
/* JavaScript by @premasagar */

var revolutionaries = (function(){
	
	// CACHE
	
	// localStorage wrapper
	function cache(key, value){
	    var ns = 'revolutionaries';
	    
	    if (!localStorage || !JSON){
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
	function jsonCache(url, callback){
	    var cached = cache(url);
	    if (cached){
	        console.log('cached');
	        callback(cached);
	    }
	    else {
	        console.log('not cached');
    	    jQuery.getJSON(url, function(data){
    	        cache(url, data);
    	        callback(data);
    	    });
    	}
	}
	

	// WIKIPEDIA / DBPEDIA
	
	function wikipedia(name, callback){
		var url = "select url from search.web where query=\"site:en.wikipedia.org '" + name + "'\" LIMIT 1";
		jsonCache(yql(url), function(data){
			if (data && data.query && data.query.results && data.query.results.result && data.query.results.result.url){
				callback(data.query.results.result.url);
			}
			else {
				callback(false);
			}
		});
	}
	
	function wikiToDbPediaUrl(url){
		return url.replace('en.wikipedia.org/wiki', 'dbpedia.org/resource');
	}
	
	function dbToWikiPediaUrl(url){
		return url.replace('dbpedia.org/resource', 'en.wikipedia.org/wiki');
	}
	
	function urlToId(url){
	    return url.replace(/^.*\/(.*)$/, '$1')
	        .toLowerCase()
	        .replace(/[^a-z\-_]/g, '');
	}
	
	function wikimediaAlternative(src){
	    return src.replace('/en/', '/commons/');
	}
	
	function wikimediaSize(src, size){
	    return src.replace(/\d+px/, size + 'px');
	}
	
	
	// YQL & SPARQL	
	
	function yql(query){
		return 'http://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(query) + '&format=json&callback=?'
	}
	
	function dbpediaQuery(sparql){
		return 'http://dbpedia.org/sparql?query=' + encodeURIComponent(sparql) + '&format=json';
	}
	
	function yqlSparqlQuery(sparql){
		return "select results from json where url='" + dbpediaQuery(sparql) + "'";
	}
	
	function yqlSparql(sparql){
	    var query = yqlSparqlQuery(sparql);
		return yql(query);
	}
	
	function yqlMulti(queries){ // NOTE: queries should use single quotes around values like urls
		return yql('select * from query.multi where queries="' + queries.join(';') + '"');
	}
	
	function dbpediaSparql(sparql, callback){
	    var url = yqlSparql(sparql);
		
		jsonCache(url, function(data){
		    // TODO: clean this up by filtering on the YQL side of things
			if (data && data.query && data.query.results && data.query.results.json && data.query.results.json.results.bindings && data.query.results.json.results.bindings){
				callback(data.query.results.json.results.bindings);
			}
			else {
				callback({});
			}
		});
	}
	
	
	// MEDIA
	
	function loadPhoto(src, alt, callback){
	    if (src){
	        // TEMP HACK: many of the image urls seem to be incorrect
	        src = wikimediaAlternative(src);
	        
	        $('<img class="photo" src="' + src + '" alt="' + (alt || '') + '">')[0].onload = function(){
	            callback.call(this);
	        };
	            //.load(callback);
	    }
	}
	
	
	// SPARQL QUERIES - sparql by @tommorris
	
	function person(dbpediaUrl, callback){
	    var thumbSize = 100;
	
		return dbpediaSparql(
		    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\
			    PREFIX foaf: <http://xmlns.com/foaf/0.1/>\
			    \
			    SELECT ?name, ?depiction, ?thumbnail, ?influences, ?abstract\
			    \
			    WHERE {\
			    <' + dbpediaUrl + '> rdfs:label ?name;\
			        foaf:depiction ?depiction ;\
			        <http://dbpedia.org/ontology/thumbnail> ?thumbnail;\
			        <http://dbpedia.org/ontology/abstract> ?abstract.\
			    \
			    FILTER langMatches( lang(?name), "EN" ) .\
			    FILTER langMatches( lang(?abstract), "EN" ) .\
		    }',
		    
		    function(data){
		        callback({
		            type: 'person-detail',
		            id: urlToId(dbpediaUrl),
		            url: dbToWikiPediaUrl(dbpediaUrl),
		            dbUrl: dbpediaUrl,
		            name: data.name ? data.name.value : '',
	                depiction: data.depiction ? data.depiction.value : '',
	                thumbnail: data.thumbnail ? wikimediaSize(data.thumbnail.value, thumbSize) : '',
	                abstract: data.abstract ? data.abstract.value : ''
		        });
		    }
		);
	}
	
	function influences(dbpediaUrl, callback){
		return dbpediaSparql(
		    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\
			    PREFIX foaf: <http://xmlns.com/foaf/0.1/>\
			    \
			    SELECT DISTINCT ?influence, ?name\
			    WHERE {\
			    ?influence\
			    <http://dbpedia.org/property/influences>\
			    <' + dbpediaUrl + '> .\
			    OPTIONAL {\
			    ?influence foaf:name ?name .\
			    }\
			    \
			    FILTER langMatches( lang(?name), "EN" ) .\
		    }',
		    
		    function(items){
		        var urls = {};
		        items = $.map(items, function(data, i){
		            var url = data.influence.value;
		            if (!urls[url]){
		                urls[url] = true;
		                return data;
		            }
		        });
		    
		        $.each(items, function(i, data){
		            items[i] = {
	                    type: 'person-summary',
	                    dbUrl: data.influence.value,
	                    url: dbToWikiPediaUrl(data.influence.value),
		                id: urlToId(data.influence.value),
		                name: data.name ? data.name.value : '',
	                    depiction: data.depiction ? data.depiction.value : '',
	                    thumbnail: data.thumbnail ? data.thumbnail.value : '',
	                    abstract: data.abstract ? data.abstract.value : ''
	                };
	            });
	            callback(items);
		    }
		);
	}
	
	function influenced(dbpediaUrl, callback, options){
		return dbpediaSparql(
		    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\
			    PREFIX foaf: <http://xmlns.com/foaf/0.1/>\
			    \
			    SELECT ?influenced, ?name\
			    WHERE {\
			    ?influenced \
			    <http://dbpedia.org/property/influenced>\
			    <' + dbpediaUrl + '> .\
			    OPTIONAL {\
			    ?influenced foaf:name ?name .\
			    }\
			    \
			    FILTER langMatches( lang(?name), "EN" ) .\
		    }',
		    
		    function(items){
		        var urls = {};
		        items = $.map(items, function(data, i){
		            var url = data.influenced.value;
		            if (!urls[url]){
		                urls[url] = true;
		                return data;
		            }
		        });
		    
		        $.each(items, function(i, data){
		            items[i] = {
	                    type: 'person-summary',
	                    dbUrl: data.influenced.value,
	                    url: dbToWikiPediaUrl(data.influenced.value),
		                id: urlToId(data.influenced.value),
		                name: data.name ? data.name.value : '',
	                    depiction: data.depiction ? data.depiction.value : '',
	                    thumbnail: data.thumbnail ? data.thumbnail.value : '',
	                    abstract: data.abstract ? data.abstract.value : ''
	                };
	            });
	            callback(items);
		    }
		);
	}
	
	
	// MICRO-TEMPLATING
	
	// Tmpl, by John Resig - http://ejohn.org/ - MIT Licensed
	// Modified as per Neil on Rick Stahl's blog http://www.west-wind.com/Weblog/posts/509108.aspx#532836
	var tmpl = (function() {
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
	               .split("%>").join("p.push('")
	               + "');}return p.join('');");
            
	        // Provide some basic currying to the user
	        return data ? fn(data) : fn;
	    };
		return tmpl;
	}()),
	
	
	// REVOLUTIONARIES API
	
	revolutionaries = {
		keyword: function(keyword, callback){
			wikipedia(keyword, function(url){
				revolutionaries.person(url, callback);
			});
		},
		
		person: function(wikipediaUrl, callback){
		    if (wikipediaUrl){
				var dbpediaUrl = wikiToDbPediaUrl(wikipediaUrl);
				
				person(dbpediaUrl, function(item){
				    item.type = 'revolutionary';
				    callback(item);
				});
				
				influences(dbpediaUrl, function(items){
				    $.each(items, function(i, item){
				        item.type = 'influence';
				        callback(item);
				        person(item.dbUrl, callback);
				    });
				});
				
				influenced(dbpediaUrl, function(items){
				    $.each(items, function(i, item){
				        item.type = 'influenced';
				        callback(item);
				        person(item.dbUrl, callback);
				    });
				});
			}
		},
		
		cache: cache,
		jsonCache: jsonCache,
		tmpl: tmpl,
		loadPhoto: loadPhoto
	};
		
	return revolutionaries;
}());
