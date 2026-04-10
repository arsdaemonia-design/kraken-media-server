import pathlib
import posixpath
import re

p = pathlib.Path('templates/index.html')
text = p.read_text(encoding='utf-8')

# 1. Update fetch calls to also pass X-Master-Pin
text = text.replace("'Authorization': 'Bearer ' + token", "'Authorization': 'Bearer ' + token,\n                        'X-Master-Pin': sessionStorage.getItem('kraken_master_pin') || ''")

# Replace generic fetch calls
text = text.replace("    'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || localStorage.getItem('kraken_auth_token') || '')\n                }", "    'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || localStorage.getItem('kraken_auth_token') || ''),\n                    'X-Master-Pin': sessionStorage.getItem('kraken_master_pin') || ''\n                }")

# 2. Inject ratingBadge logic in createCard
badge_code = '''                // TMDB RATING
                const ratingVal = f.tmdb_rating;
                let ratingBadge = '';
                if (ratingVal) {
                    let rColor = 'bg-emerald-600/80 border-emerald-500/50';
                    if (['R', 'NC-17', 'C', 'D'].includes(ratingVal)) rColor = 'bg-red-600/80 border-red-500/50';
                    else if (['PG-13', 'B-15', 'B'].includes(ratingVal)) rColor = 'bg-orange-500/80 border-orange-500/50';
                    ratingBadge = `<div class="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded ${rColor} backdrop-blur text-white text-[9px] font-bold tracking-wider shadow-lg border uppercase">${escapeHtml(ratingVal)}</div>`;
                }

                // ? INDICADOR DE FAVORITO (Corazón en la esquina)
                const isFavorite = f.rating === 1;
                const favBadge = isFavorite ? `<div class="absolute top-2 ${ratingVal ? 'left-12' : 'left-2'} z-20 w-6 h-6 bg-black/60 backdrop-blur rounded-full flex items-center justify-center animate-pulse">
            <i class="fa-solid fa-heart text-emerald-400 text-xs drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"></i>
        </div>` : '';'''

import re
text = re.sub(r"                // \? INDICADOR DE FAVORITO \(Coraz.n en la esquina\).*?const favBadge = isFavorite \? \`[^`]*\` : '';", badge_code, text, flags=re.DOTALL)

# Insert ${ratingBadge} before ${favBadge} in the HTML template
text = text.replace('${favBadge}', '${ratingBadge}\n                ${favBadge}')

p.write_text(text, encoding='utf-8')
print("HTML patch completado.")
