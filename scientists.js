var scientists = (function(){
	
	function dbpediaQuery(sparql){
		return 'http://dbpedia.org/sparql?query=' + encodeURIComponent(sparql) + '&format=json';
	}
	
	function yqlSparql(sparql){
		return yql("select results from json where url='" + dbpediaQuery(sparql) + "'");
	}
	
	function yql(query){
		return 'http://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(query) + '&format=json&callback=?'
	}
	
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
	
	function scientist(dbpediaUrl, callback){
		var sparqlScientist = 'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\
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
		url = yqlSparql(sparqlScientist);
		
		jQuery.getJSON(url, function(data){
			if (data && data.query && data.query.results && data.query.results.json && data.query.results.json.results.bindings && data.query.results.json.results.bindings){
				callback(data.query.results.json.results.bindings);
			}
			else {
				callback({});
			}
		});
	}
	
	
	// Simple JavaScript Templating
	// John Resig - http://ejohn.org/ - MIT Licensed
	// Modified by Neil, on Rick Stahl's blog http://www.west-wind.com/Weblog/posts/509108.aspx#532836
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
	
	_ = window.console && window.console.log ? window.console.log : function(){},
	scientists = {
		person: scientist,

		init: function(){
			wikipedia('isaac newton', function(url){
				if (url){
					url = url.replace('en.wikipedia.org/wiki', 'dbpedia.org/resource');
					scientist(url, function(data){
						jQuery('#demo').html(tmpl('person', data));
					});
				}
			});
		}
	};
		
	return scientists;
}());