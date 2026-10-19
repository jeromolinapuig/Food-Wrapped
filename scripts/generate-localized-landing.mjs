import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const origin = 'https://burger-wrapped.es';
const locales = ['es', 'en', 'fr', 'de', 'it', 'th', 'ja'];
const langTags = { es: 'es-ES', en: 'en', fr: 'fr', de: 'de', it: 'it', th: 'th', ja: 'ja' };
const ogLocales = { es: 'es_ES', en: 'en_US', fr: 'fr_FR', de: 'de_DE', it: 'it_IT', th: 'th_TH', ja: 'ja_JP' };
const escape = (value) => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const urlFor = locale => locale === 'es' ? origin + '/' : origin + '/' + locale + '/';
const alternateTags = locales.map(l => '<link rel="alternate" hreflang="' + l + '" href="' + urlFor(l) + '" />').join('\n    ')
  + '\n    <link rel="alternate" hreflang="x-default" href="' + origin + '/" />';
const template = readFileSync('dist/index.html', 'utf8');

for (const locale of locales) {
  const landing = JSON.parse(readFileSync(join('src', 'locales', locale, 'landing.json'), 'utf8'));
  const url = urlFor(locale);
  const title = 'Burger Wrapped – ' + landing.subtitle;
  const description = landing.lead + ' ' + landing.feedDesc;
  const encodedTitle = escape(title);
  const encodedDescription = escape(description);
  const jsonLd = JSON.stringify({ '@context':'https://schema.org', '@type':'WebSite', name:'Burger Wrapped', url, description, inLanguage:langTags[locale] }).replace(/</g, '\\u003c');
  const head = [
    '<title>' + encodedTitle + '</title>',
    '<meta name="description" content="' + encodedDescription + '" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="' + ogLocales[locale] + '" />',
    '<meta property="og:title" content="' + encodedTitle + '" />',
    '<meta property="og:description" content="' + encodedDescription + '" />',
    '<meta property="og:image" content="' + origin + '/logo.png" />',
    '<meta property="og:url" content="' + url + '" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' + encodedTitle + '" />',
    '<meta name="twitter:description" content="' + encodedDescription + '" />',
    '<meta name="twitter:image" content="' + origin + '/logo.png" />',
    '<link rel="canonical" href="' + url + '" />',
    alternateTags,
    '<script type="application/ld+json">' + jsonLd + '</script>'
  ].join('\n    ');
  let html = template.replace(/<html lang="[^"]*">/, '<html lang="' + langTags[locale] + '">');
  html = html.replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, '')
    .replace(/<meta\s+property="og:[\s\S]*?\/>/g, '')
    .replace(/<meta\s+name="twitter:[\s\S]*?\/>/g, '')
    .replace(/<link rel="canonical"[^>]*\/>/, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
    .replace('</head>', '    ' + head + '\n  </head>');
  // A meaningful crawlable landing is available even before the React bundle runs.
  const staticLanding = '<main lang="' + langTags[locale] + '"><h1>Burger Wrapped</h1><h2>' + escape(landing.subtitle) + '</h2>'
    + '<p>' + escape(landing.lead) + '</p><h2>' + escape(landing.featuresTitle) + '</h2>'
    + [ ['dashboardTitle','dashboardDesc'],['feedTitle','feedDesc'],['groupsTitle','groupsDesc'],['wrappedTitle','wrappedDesc'] ]
      .map(([a,b]) => '<section><h3>' + escape(landing[a]) + '</h3><p>' + escape(landing[b]) + '</p></section>').join('')
    + '</main>';
  html = html.replace('<div id="root"></div>', '<div id="root">' + staticLanding + '</div>');
  const target = locale === 'es' ? 'dist/index.html' : join('dist', locale, 'index.html');
  if (locale !== 'es') mkdirSync(join('dist', locale), { recursive:true });
  writeFileSync(target, html);
}
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
  + locales.map(l => '  <url>\n    <loc>' + urlFor(l) + '</loc>\n'
      + locales.map(other => '    <xhtml:link rel="alternate" hreflang="' + other + '" href="' + urlFor(other) + '"/>').join('\n')
      + '\n    <xhtml:link rel="alternate" hreflang="x-default" href="' + urlFor('es') + '"/>\n  </url>').join('\n')
  + '\n</urlset>\n';
writeFileSync('dist/sitemap.xml', sitemap);
