export type DeprecationRule = {
  id: string
  label: string
  type:
    | 'method'
    | 'property'
    | 'selector'
    | 'event'
    | 'ajax-event'
    | 'utility'
    | 'deferred'
  deprecated: string
  removed?: string
  pattern: RegExp
  docsUrl: string
  categoryUrl: string
  replacement?: string
  replacementUrl?: string
  notes?: string
  ambiguous?: boolean
}

type RawRule = Omit<DeprecationRule, 'pattern'> & {
  pattern: string
  flags?: string
}

const rawRules: RawRule[] = [
      {
    id: 'jquery-browser',
    label: 'jQuery.browser',
    type: 'property',
    deprecated: '1.3',
    removed: '1.9',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*browser\b`,
    docsUrl: 'https://api.jquery.com/jQuery.browser/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.3/',
    replacement: 'Use feature detection instead of browser sniffing.',
    replacementUrl: 'https://api.jquery.com/jQuery.browser/'
  },
  {
    id: 'jquery-boxModel',
    label: 'jQuery.boxModel',
    type: 'property',
    deprecated: '1.3',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*boxModel\b`,
    docsUrl: 'https://api.jquery.com/jQuery.boxModel/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.3/',
    replacement: 'Check document.compatMode === "CSS1Compat" and avoid quirks mode.',
    replacementUrl: 'https://api.jquery.com/jQuery.boxModel/'
  },
  {
    id: 'deferred-isRejected',
    label: 'deferred.isRejected()',
    type: 'deferred',
    deprecated: '1.7',
    pattern: String.raw`\.isRejected\s*\(`,
    docsUrl: 'https://api.jquery.com/deferred.isRejected/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.7/',
    replacement: 'Use deferred.state() instead.',
    replacementUrl: 'https://api.jquery.com/deferred.state/',
    ambiguous: true,
    notes: 'This match is heuristic and may not be a jQuery Deferred.'
  },
  {
    id: 'deferred-isResolved',
    label: 'deferred.isResolved()',
    type: 'deferred',
    deprecated: '1.7',
    pattern: String.raw`\.isResolved\s*\(`,
    docsUrl: 'https://api.jquery.com/deferred.isResolved/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.7/',
    replacement: 'Use deferred.state() instead.',
    replacementUrl: 'https://api.jquery.com/deferred.state/',
    ambiguous: true,
    notes: 'This match is heuristic and may not be a jQuery Deferred.'
  },
  {
    id: 'die',
    label: '.die()',
    type: 'method',
    deprecated: '1.7',
    removed: '1.9',
    pattern: String.raw`\.die\s*\(`,
    docsUrl: 'https://api.jquery.com/die/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.7/',
    replacement: 'Use .on() instead.',
    replacementUrl: 'https://api.jquery.com/on/'
  },
  {
    id: 'live',
    label: '.live()',
    type: 'method',
    deprecated: '1.7',
    removed: '1.9',
    pattern: String.raw`\.live\s*\(`,
    docsUrl: 'https://api.jquery.com/live/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.7/',
    replacement: 'Use .on() (or .delegate()) instead.',
    replacementUrl: 'https://api.jquery.com/on/'
  },
  {
    id: 'jquery-sub',
    label: 'jQuery.sub()',
    type: 'utility',
    deprecated: '1.7',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*sub\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.sub/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.7/'
  },
  {
    id: 'selector-prop',
    label: '.selector',
    type: 'property',
    deprecated: '1.7',
    pattern: String.raw`\.selector\b`,
    docsUrl: 'https://api.jquery.com/selector/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.7/',
    replacement: 'Store the selector string explicitly if you need it.',
    replacementUrl: 'https://api.jquery.com/selector/'
  },
  {
    id: 'andSelf',
    label: '.andSelf()',
    type: 'method',
    deprecated: '1.8',
    pattern: String.raw`\.andSelf\s*\(`,
    docsUrl: 'https://api.jquery.com/andSelf/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.8/',
    replacement: 'Use .addBack() instead.',
    replacementUrl: 'https://api.jquery.com/addBack/'
  },
  {
    id: 'deferred-pipe',
    label: 'deferred.pipe()',
    type: 'deferred',
    deprecated: '1.8',
    pattern: String.raw`\.pipe\s*\(`,
    docsUrl: 'https://api.jquery.com/deferred.pipe/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.8/',
    replacement: 'Use deferred.then() instead.',
    replacementUrl: 'https://api.jquery.com/deferred.then/',
    ambiguous: true,
    notes: 'This match is heuristic and may not be a jQuery Deferred.'
  },
  {
    id: 'error-event',
    label: '.error() event shorthand',
    type: 'event',
    deprecated: '1.8',
    pattern: String.raw`\.error\s*\(`,
    docsUrl: 'https://api.jquery.com/error/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.8/',
    replacement: 'Use .on("error", handler) or .trigger("error") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand, not $.ajax error handling.'
  },
  {
    id: 'load-event',
    label: '.load() event shorthand',
    type: 'event',
    deprecated: '1.8',
    pattern: String.raw`\.load\s*\(`,
    docsUrl: 'https://api.jquery.com/load-event/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.8/',
    replacement: 'Use .on("load", handler) or .trigger("load") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand, not $.ajax .load().' 
  },
  {
    id: 'unload-event',
    label: '.unload() event shorthand',
    type: 'event',
    deprecated: '1.8',
    pattern: String.raw`\.unload\s*\(`,
    docsUrl: 'https://api.jquery.com/unload/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.8/',
    replacement: 'Use .on("unload", handler) or .trigger("unload") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand.'
  },
  {
    id: 'size',
    label: '.size()',
    type: 'method',
    deprecated: '1.8',
    pattern: String.raw`\.size\s*\(`,
    docsUrl: 'https://api.jquery.com/size/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.8/',
    replacement: 'Use the .length property instead.',
    replacementUrl: 'https://api.jquery.com/length/'
  },
  {
    id: 'toggle-event',
    label: '.toggle() event shorthand',
    type: 'event',
    deprecated: '1.8',
    pattern: String.raw`\.toggle\s*\(`,
    docsUrl: 'https://api.jquery.com/toggle-event/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.8/',
    ambiguous: true,
    notes: 'Ambiguous with the effects .toggle(); only the event shorthand is deprecated.'
  },
  {
    id: 'jquery-support',
    label: 'jQuery.support',
    type: 'property',
    deprecated: '1.9',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*support\b`,
    docsUrl: 'https://api.jquery.com/jQuery.support/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.9/',
    replacement: 'Use feature detection and consider Modernizr.',
    replacementUrl: 'https://api.jquery.com/jQuery.support/'
  },
  {
    id: 'context',
    label: '.context',
    type: 'property',
    deprecated: '1.10',
    removed: '3.0',
    pattern: String.raw`\.context\b`,
    docsUrl: 'https://api.jquery.com/context/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-1.10-and-2.0/'
  },
  {
    id: 'bind',
    label: '.bind()',
    type: 'method',
    deprecated: '3.0',
    pattern: String.raw`\.bind\s*\(`,
    docsUrl: 'https://api.jquery.com/bind/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.0/',
    replacement: 'Use .on() instead.',
    replacementUrl: 'https://api.jquery.com/on/'
  },
  {
    id: 'delegate',
    label: '.delegate()',
    type: 'method',
    deprecated: '3.0',
    pattern: String.raw`\.delegate\s*\(`,
    docsUrl: 'https://api.jquery.com/delegate/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.0/',
    replacement: 'Use .on() instead.',
    replacementUrl: 'https://api.jquery.com/on/'
  },
  {
    id: 'unbind',
    label: '.unbind()',
    type: 'method',
    deprecated: '3.0',
    pattern: String.raw`\.unbind\s*\(`,
    docsUrl: 'https://api.jquery.com/unbind/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.0/',
    replacement: 'Use .off() instead.',
    replacementUrl: 'https://api.jquery.com/off/'
  },
  {
    id: 'undelegate',
    label: '.undelegate()',
    type: 'method',
    deprecated: '3.0',
    pattern: String.raw`\.undelegate\s*\(`,
    docsUrl: 'https://api.jquery.com/undelegate/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.0/',
    replacement: 'Use .off() instead.',
    replacementUrl: 'https://api.jquery.com/off/'
  },
  {
    id: 'parseJSON',
    label: 'jQuery.parseJSON()',
    type: 'utility',
    deprecated: '3.0',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*parseJSON\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.parseJSON/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.0/',
    replacement: 'Use JSON.parse() instead.',
    replacementUrl: 'https://api.jquery.com/jQuery.parseJSON/'
  },
  {
    id: 'unique',
    label: 'jQuery.unique()',
    type: 'utility',
    deprecated: '3.0',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*unique\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.unique/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.0/',
    replacement: 'Use jQuery.uniqueSort() instead.',
    replacementUrl: 'https://api.jquery.com/jQuery.uniqueSort/'
  },
  {
    id: 'fx-interval',
    label: 'jQuery.fx.interval',
    type: 'property',
    deprecated: '3.0',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*fx\s*\.\s*interval\b`,
    docsUrl: 'https://api.jquery.com/jQuery.fx.interval/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.0/',
    notes: 'Deprecated because it has no effect with requestAnimationFrame.'
  },
  {
    id: 'holdReady',
    label: 'jQuery.holdReady()',
    type: 'utility',
    deprecated: '3.2',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*holdReady\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.holdReady/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.2/',
    replacement:
      'Use $.when($.ready, customPromise).then(...) and handle errors with .catch(...).',
    replacementUrl: 'https://api.jquery.com/jQuery.holdReady/'
  },
  {
    id: 'isArray',
    label: 'jQuery.isArray()',
    type: 'utility',
    deprecated: '3.2',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*isArray\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.isArray/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.2/',
    replacement: 'Use Array.isArray() instead.',
    replacementUrl: 'https://api.jquery.com/jQuery.isArray/'
  },
  {
    id: 'blur-event',
    label: '.blur() event shorthand',
    type: 'event',
    deprecated: '3.3',
    pattern: String.raw`\.blur\s*\(`,
    docsUrl: 'https://api.jquery.com/blur/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use .on("blur", handler) or .trigger("blur") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand.'
  },
  {
    id: 'change-event',
    label: '.change() event shorthand',
    type: 'event',
    deprecated: '3.3',
    pattern: String.raw`\.change\s*\(`,
    docsUrl: 'https://api.jquery.com/change/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use .on("change", handler) or .trigger("change") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand.'
  },
  {
    id: 'click-event',
    label: '.click() event shorthand',
    type: 'event',
    deprecated: '3.3',
    pattern: String.raw`\.click\s*\(`,
    docsUrl: 'https://api.jquery.com/click/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use .on("click", handler) or .trigger("click") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand.'
  },
  {
    id: 'contextmenu-event',
    label: '.contextmenu() event shorthand',
    type: 'event',
    deprecated: '3.3',
    pattern: String.raw`\.contextmenu\s*\(`,
    docsUrl: 'https://api.jquery.com/contextmenu/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use .on("contextmenu", handler) or .trigger("contextmenu") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand.'
  },
  {
    id: 'dblclick-event',
    label: '.dblclick() event shorthand',
    type: 'event',
    deprecated: '3.3',
    pattern: String.raw`\.dblclick\s*\(`,
    docsUrl: 'https://api.jquery.com/dblclick/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use .on("dblclick", handler) or .trigger("dblclick") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand.'
  },
  {
    id: 'mousemove-event',
    label: '.mousemove() event shorthand',
    type: 'event',
    deprecated: '3.3',
    pattern: String.raw`\.mousemove\s*\(`,
    docsUrl: 'https://api.jquery.com/mousemove/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use .on("mousemove", handler) or .trigger("mousemove") instead.',
    replacementUrl: 'https://api.jquery.com/on/',
    ambiguous: true,
    notes: 'This is only for the event shorthand.'
  },
  {
    id: 'isFunction',
    label: 'jQuery.isFunction()',
    type: 'utility',
    deprecated: '3.3',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*isFunction\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.isFunction/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use typeof x === "function" instead.',
    replacementUrl: 'https://api.jquery.com/jQuery.isFunction/'
  },
  {
    id: 'isWindow',
    label: 'jQuery.isWindow()',
    type: 'utility',
    deprecated: '3.3',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*isWindow\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.isWindow/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Reimplement: obj != null && obj === obj.window.',
    replacementUrl: 'https://api.jquery.com/jQuery.isWindow/'
  },
  {
    id: 'now',
    label: 'jQuery.now()',
    type: 'utility',
    deprecated: '3.3',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*now\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.now/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use Date.now() instead.',
    replacementUrl: 'https://api.jquery.com/jQuery.now/'
  },
  {
    id: 'proxy',
    label: 'jQuery.proxy()',
    type: 'utility',
    deprecated: '3.3',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*proxy\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.proxy/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/',
    replacement: 'Use Function.prototype.bind() instead.',
    replacementUrl: 'https://api.jquery.com/jQuery.proxy/'
  },
  {
    id: 'type',
    label: 'jQuery.type()',
    type: 'utility',
    deprecated: '3.3',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*type\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.type/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.3/'
  },
  {
    id: 'selector-eq',
    label: ':eq()',
    type: 'selector',
    deprecated: '3.4',
    pattern: String.raw`:eq\s*\(`,
    docsUrl: 'https://api.jquery.com/eq-selector/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.4/',
    replacement: 'Use .eq() instead.',
    replacementUrl: 'https://api.jquery.com/eq/'
  },
  {
    id: 'selector-even',
    label: ':even',
    type: 'selector',
    deprecated: '3.4',
    pattern: String.raw`:even\b`,
    docsUrl: 'https://api.jquery.com/even-selector/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.4/',
    replacement: 'Use .even() instead.',
    replacementUrl: 'https://api.jquery.com/even/'
  },
  {
    id: 'selector-first',
    label: ':first',
    type: 'selector',
    deprecated: '3.4',
    pattern: String.raw`:first\b`,
    docsUrl: 'https://api.jquery.com/first-selector/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.4/',
    replacement: 'Use .first() instead.',
    replacementUrl: 'https://api.jquery.com/first/'
  },
  {
    id: 'selector-gt',
    label: ':gt()',
    type: 'selector',
    deprecated: '3.4',
    pattern: String.raw`:gt\s*\(`,
    docsUrl: 'https://api.jquery.com/gt-selector/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.4/',
    replacement: 'Use .slice(index + 1) instead.',
    replacementUrl: 'https://api.jquery.com/slice/'
  },
  {
    id: 'selector-last',
    label: ':last',
    type: 'selector',
    deprecated: '3.4',
    pattern: String.raw`:last\b`,
    docsUrl: 'https://api.jquery.com/last-selector/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.4/',
    replacement: 'Use .last() instead.',
    replacementUrl: 'https://api.jquery.com/last/'
  },
  {
    id: 'selector-lt',
    label: ':lt()',
    type: 'selector',
    deprecated: '3.4',
    pattern: String.raw`:lt\s*\(`,
    docsUrl: 'https://api.jquery.com/lt-selector/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.4/',
    replacement: 'Use .slice(0, index) instead.',
    replacementUrl: 'https://api.jquery.com/slice/'
  },
  {
    id: 'selector-odd',
    label: ':odd',
    type: 'selector',
    deprecated: '3.4',
    pattern: String.raw`:odd\b`,
    docsUrl: 'https://api.jquery.com/odd-selector/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.4/',
    replacement: 'Use .odd() instead.',
    replacementUrl: 'https://api.jquery.com/odd/'
  },
  {
    id: 'ajax-complete',
    label: '.ajaxComplete()',
    type: 'ajax-event',
    deprecated: '3.5',
    pattern: String.raw`\.ajaxComplete\s*\(`,
    docsUrl: 'https://api.jquery.com/ajaxComplete/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.5/',
    replacement: 'Use .on("ajaxComplete", handler) instead.',
    replacementUrl: 'https://api.jquery.com/ajaxComplete/'
  },
  {
    id: 'ajax-error',
    label: '.ajaxError()',
    type: 'ajax-event',
    deprecated: '3.5',
    pattern: String.raw`\.ajaxError\s*\(`,
    docsUrl: 'https://api.jquery.com/ajaxError/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.5/',
    replacement: 'Use .on("ajaxError", handler) instead.',
    replacementUrl: 'https://api.jquery.com/ajaxError/'
  },
  {
    id: 'ajax-start',
    label: '.ajaxStart()',
    type: 'ajax-event',
    deprecated: '3.5',
    pattern: String.raw`\.ajaxStart\s*\(`,
    docsUrl: 'https://api.jquery.com/ajaxStart/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.5/',
    replacement: 'Use .on("ajaxStart", handler) instead.',
    replacementUrl: 'https://api.jquery.com/ajaxStart/'
  },
  {
    id: 'trim',
    label: 'jQuery.trim()',
    type: 'utility',
    deprecated: '3.5',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*trim\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.trim/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.5/',
    replacement: 'Use String.prototype.trim() instead.',
    replacementUrl: 'https://api.jquery.com/jQuery.trim/'
  },
  {
    id: 'deferred-getStackHook',
    label: 'jQuery.Deferred.getStackHook()',
    type: 'deferred',
    deprecated: '3.7',
    pattern: String.raw`\b(?:jQuery|\$)\s*\.\s*Deferred\s*\.\s*getStackHook\s*\(`,
    docsUrl: 'https://api.jquery.com/jQuery.Deferred.getStackHook/',
    categoryUrl: 'https://api.jquery.com/category/deprecated/deprecated-3.7/',
    replacement: 'Use jQuery.Deferred.getErrorHook() instead.',
    replacementUrl: 'https://api.jquery.com/jQuery.Deferred.getErrorHook/'
  }
]

export const deprecationRules: DeprecationRule[] = rawRules.map((rule) => ({
  ...rule,
  pattern: new RegExp(rule.pattern, rule.flags ?? 'g')
}))