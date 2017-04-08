/**
 * Responsible for executing a deferred request to the MediaWiki back-end to
 * retrieve the representation for a #ask query.
 */

/*global jQuery, mediaWiki, smw */
/*jslint white: true */

( function( $, mw, onoi ) {

	'use strict';

	/**
	 * @since 3.0
	 * @constructor
	 *
	 * @param container {Object}
	 * @param api {Object}
	 */
	var dQuery = function ( container, api ) {

		this.VERSION = "3.0";

		this.container = container;
		this.mwApi = api;

		this.query = container.data( 'query' );
		this.cmd = container.data( 'cmd' );
		this.control = container.find( '#deferred-control' ).data( 'control' );

		this.limit = container.data( 'limit' );
		this.offset = container.data( 'offset' );
		this.rangeLimit = this.limit;

		this.max = container.data( 'max' );
		this.step = 1;
		this.postfix = '';

		// Ensure to have a limit parameter for queries that use
		// the default setting
		if ( this.query.indexOf( "|limit=" ) == -1 ) {
			this.query = this.query + '|limit=' + this.limit;
		}
	};

	/**
	 * Parse a #ask/#show query using the MediaWiki API back-end
	 *
	 * @since 3.0
	 */
	dQuery.prototype.parse = function() {

		var self = this;

		// Replace limit with that of the range
		var query = self.query.replace(
			'limit=' + self.limit,
			'limit=' + self.rangeLimit
		);

		// API notes "modules: Gives the ResourceLoader modules used on the page.
		// Either jsconfigvars or encodedjsconfigvars must be requested jointly
		// with modules. 1.24+"

		self.mwApi.post( {
			action: "parse",
			contentmodel: 'wikitext',
			prop: 'text|modules|jsconfigvars',
			text: '{{#' + self.cmd + ':' +  query + '}}'
		} ).done( function( data ) {

			// Remove any comments retrieved from the API parse
			var text = data.parse.text['*'].replace(/<!--[\S\s]*?-->/gm, '' );
			self.replaceOutput( text, '', data.parse.modules );

		} ).fail ( function( code, details ) {
			var error =  code + ': ' + details.textStatus;

			if ( details.error.hasOwnProperty( 'info' ) ) {
				error = details.error.info;
			}

			self.container.find( '#deferred-control' ).replaceWith( "<div id='deferred-control'></div>" );
			self.container.find( '.irs' ).hide();
			self.replaceOutput( error, "smw-callout smw-callout-error" );
		} );
	};

	/**
	 * Replace output with generated content
	 *
	 * @since 3.0
	 *
	 * @param text {String}
	 * @param oClass {String}
	 * @param modules {Array}
	 *
	 * @return {this}
	 */
	dQuery.prototype.replaceOutput = function( text, oClass, modules ) {

		var self = this;

		oClass = oClass !== undefined ? "class='" + oClass + "'" : '';

		var element = this.cmd === 'ask' ? 'div' : 'span';

		// Remove any <p> element to avoid line breakages
		if ( this.cmd === 'show' ) {
			text = text.replace( /(?:^<p[^>]*>)|(?:<\/p>$)/g, "");
		}

		self.container.find( '#deferred-output' ).replaceWith(
			"<" + element + " id='deferred-output'" + oClass + ">" + text + "</" + element + ">"
		);

		self.reload( modules );
	};

	/**
	 * Reload module objects that rely on JavaScript to be executed after a
	 * fresh parse.
	 *
	 * @since 3.0
	 *
	 * @param modules {Array}
	 */
	dQuery.prototype.reload = function( modules ) {

		var self = this;

		if ( modules !== undefined ) {
			mw.loader.using( modules );
		}

		// Trigger an event to allow re-apply JS-component instances on new content
		mw.hook( 'smw.deferred.query' ).fire( self.container );

		// MW's table sorter isn't listed as page module therefore make an exception
		// and reload it manually
		if ( self.container.find( '#deferred-output table' ).text() !== '' ) {
			mw.loader.using( 'jquery.tablesorter' ).done( function () {
				self.container.find( '#deferred-output table' ).tablesorter();
			} );
		}
	};

	/**
	 * Executes and manages the initialization of the "ionRangeSlider"
	 *
	 * @since 3.0
	 */
	dQuery.prototype.slider = function() {

		var self = this;
		var loading = '<span class="smw-overlay-spinner large inline" alt="Loading..."></span>';

		self.container.find( '#deferred-control' ).ionRangeSlider( {
			min: self.limit + self.offset,
			max: self.max,
			step: self.step,
			from: self.limit,
			force_edges: true,
			postfix: self.postfix,
			onChange: function ( data ) {
				self.container.find( '#deferred-output' ).addClass( 'is-disabled' ).prepend( loading );
			},
			onFinish: function ( data ) {
				self.rangeLimit = data.from - self.offset;
				self.parse();
			}
		} );
	};

	/**
	 * @since 3.0
	 */
	$( '.smw-deferred-query' ).each( function() {

		var deferredQ = new dQuery(
			$( this ),
			new mw.Api()
		);

		deferredQ.parse();

		if ( deferredQ.control === 'slider' ) {
			deferredQ.replaceOutput( '' );
			deferredQ.slider();
		}
	} );

}( jQuery, mediaWiki ) );
