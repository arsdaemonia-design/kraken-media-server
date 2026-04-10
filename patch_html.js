const fs = require('fs');
let html = fs.readFileSync('templates/index.html', 'utf8');

html = html.replace(/'Authorization': 'Bearer ' \+ token/g, "'Authorization': 'Bearer ' + token,\n                        'X-Master-Pin': sessionStorage.getItem('kraken_master_pin') || ''");

html = html.replace(/'Authorization': 'Bearer ' \+ \(window\.krakenAuth\?\.getToken\(\) \|\| localStorage\.getItem\('kraken_auth_token'\) \|\| ''\)/g, "'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || localStorage.getItem('kraken_auth_token') || ''),\n                    'X-Master-Pin': sessionStorage.getItem('kraken_master_pin') || ''");

const ratingBadgeCode =                 // TMDB RATING
                const ratingVal = f.tmdb_rating;
                let ratingBadge = '';
                if (ratingVal) {
                    let rColor = 'bg-emerald-600/80 border-emerald-500/50';
                    if (['R', 'NC-17', 'C', 'D'].includes(ratingVal)) rColor = 'bg-red-600/80 border-red-500/50';
                    else if (['PG-13', 'B-15', 'B'].includes(ratingVal)) rColor = 'bg-orange-500/80 border-orange-500/50';
                    ratingBadge = \\\<div class=\"absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded \\\ backdrop-blur text-white text-[9px] font-bold tracking-wider shadow-lg border uppercase\">\\\</div>\\\;
                }

                // INDICADOR DE FAVORITO
                const isFavorite = f.rating === 1;
                const favBadge = isFavorite ? \\\<div class=\"absolute top-2 \\\ z-20 w-6 h-6 bg-black/60 backdrop-blur rounded-full flex items-center justify-center animate-pulse\"><i class=\"fa-solid fa-heart text-emerald-400 text-[10px] drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]\"></i></div>\\\ : '';;

html = html.replace(/\/\/ \? INDICADOR DE FAVORITO[\s\S]*?const favBadge = isFavorite \? [\s\S]*? : '';/m, ratingBadgeCode);

// Finally, inject ratingBadge into the actual HTML card
html = html.replace(/\$\{favBadge\}/g, "\\n                ");

fs.writeFileSync('templates/index.html', html, 'utf8');
console.log('Done indexing HTML');
