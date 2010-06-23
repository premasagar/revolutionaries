/* Revolutionaries: http://dharmfly.com/revolutionaries */
/* JavaScript by @premasagar */

var revolutionaries = (function(){
	
	// GENERAL API
	
	function yql(query){
		return 'http://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(query) + '&format=json&callback=?'
	}
	
	
	// HUMAN INTERFACE
	
	function wikipedia(name, callback){
		var url = "select url from search.web where query=\"site:en.wikipedia.org '" + name + "'\" LIMIT 1";
		jQuery.getJSON(yql(url), function(data){
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
		return url.replace('en.wikipedia.org/wiki', 'dbpedia.org/resource');
	}
	
	
	// SPARQL WRAPPERS
	
	function dbpediaQuery(sparql){
		return 'http://dbpedia.org/sparql?query=' + encodeURIComponent(sparql) + '&format=json';
	}
	
	function yqlSparql(sparql){
		return yql("select results from json where url='" + dbpediaQuery(sparql) + "'");
	}
	
	function dbpediaSparql(sparql, callback){
	    var url = yqlSparql(sparql);
		
		jQuery.getJSON(url, function(data){
		    // TODO: clean this up by filtering on the YQL side of things
			if (data && data.query && data.query.results && data.query.results.json && data.query.results.json.results.bindings && data.query.results.json.results.bindings){
				callback(data.query.results.json.results.bindings);
			}
			else {
				callback({});
			}
		});
	}
	
	
	// SPARQL QUERIES - written by @tommorris
	
	function person(dbpediaUrl, callback){
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
		    callback
		);
	}
	
	function influences(dbpediaurl, callback){
		return dbpediaSparql(
		    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\
			    PREFIX foaf: <http://xmlns.com/foaf/0.1/>\
			    \
			    SELECT DISTINCT ?influence, ?name\
			    WHERE {\
			    ?influence\
			    <http://dbpedia.org/property/influences>\
			    <' + dbpediaurl + '> .\
			    OPTIONAL {\
			    ?influence foaf:name ?name .\
			    }\
			    \
			    FILTER langMatches( lang(?name), "EN" ) .\
		    }',
		    callback
		);
	}
	
	function influenced(dbpediaurl, callback){
		return dbpediaSparql(
		    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\
			    PREFIX foaf: <http://xmlns.com/foaf/0.1/>\
			    \
			    SELECT ?influenced, ?name\
			    WHERE {\
			    ?influenced \
			    <http://dbpedia.org/property/influenced>\
			    <http://dbpedia.org/resource/Isaac_Newton>\
			    OPTIONAL {\
			    ?influenced foaf:name ?name .\
			    }\
			    \
			    FILTER langMatches( lang(?name), "EN" ) .\
		    }',
		    callback
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
	
	
	
	// CONSOLE LOGGING
	
	_ = window.console && window.console.log ? window.console.log : function(){},
	
	
	// REVOLUTIONARIES API
	
	revolutionaries = {
		person: function(keyword, callback){
			wikipedia(keyword, function(url){
				if (url){
					var dbpediaUrl = wikiToDbPediaUrl(url);
					
					function personSummary(type, data){
					    _('personSummary', type, data, data[type]);
						return {
						    name: data.name.value,
						    url: dbToWikiPediaUrl(data[type].value),
						    depiction: '' // TODO
						};
					}
					
					function personDetail(type, data){
					    _('personDetail', type, data);
						return {
						    type: type,
						    name: data.name.value,
						    url: url,
						    depiction: data.depiction.value,
						    abstract: data.abstract.value
						};
					}
					
					person(dbpediaUrl, function(data){
						callback(personDetail('revolutionary', data));
					});
					
					influences(dbpediaUrl, function(data){
					    var type = 'influences',
					        items = [];
					    $.each(data, function(i, item){
					        items.push(personSummary('influence', item));
					    });
						callback({
						    type: type,
						    items: items
						});
					});
					
					influenced(dbpediaUrl, function(data){
					    var type = 'influenced',
					        items = [];
					    $.each(data, function(i, item){
					        items.push(personSummary('influenced', item));
					    });
						callback({
						    type: type,
						    items: items
						});
					});
				}
			});
		},
		tmpl: tmpl
	};
		
	return revolutionaries;
}());
