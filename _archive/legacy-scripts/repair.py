import pathlib

p_html = pathlib.Path('templates/index.html')
text_html = p_html.read_text(encoding='utf-8')

# Fix Virtual folders missing tmdb_rating
old_chunk = '''                                        folder_type: f.folder_type,
                                        tmdb_id: f.tmdb_id,
                                        tmdb_poster: folderPoster
                                    });'''

new_chunk = '''                                        folder_type: f.folder_type,
                                        tmdb_id: f.tmdb_id,
                                        tmdb_poster: folderPoster,
                                        tmdb_rating: source.find(v => v.path.startsWith(showPathToOpen) && v.tmdb_rating)?.tmdb_rating
                                    });'''

text_html = text_html.replace(old_chunk, new_chunk)

# Fix createCard rating colors
old_rating = '''                    let rColor = 'bg-emerald-600/80 border-emerald-500/50';
                    if (['R', 'NC-17', 'C', 'D'].includes(ratingVal)) rColor = 'bg-red-600/80 border-red-500/50';
                    else if (['PG-13', 'B-15', 'B'].includes(ratingVal)) rColor = 'bg-orange-500/80 border-orange-500/50';
                    ratingBadge = `<div class="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded ${rColor} backdrop-blur text-white text-[10px] font-bold tracking-wider shadow-lg border uppercase">${escapeHtml(ratingVal)}</div>`;'''

new_rating = '''                    let rColor = 'bg-emerald-600/80 border-emerald-500/50';
                    if (['R', 'NC-17', 'C', 'D', '18', '16', '16+', '18+', 'MA15+', 'R18+', 'R15+'].includes(ratingVal)) rColor = 'bg-red-600/80 border-red-500/50';
                    else if (['PG-13', 'B-15', 'B', 'M', 'TV-MA', 'TV-14'].includes(ratingVal)) rColor = 'bg-orange-500/80 border-orange-500/50';
                    else if (['PG', 'A'].includes(ratingVal)) rColor = 'bg-blue-500/80 border-blue-500/50';
                    ratingBadge = `<div class="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded ${rColor} backdrop-blur text-white text-[10px] font-bold tracking-wider shadow-lg border uppercase">${escapeHtml(ratingVal)}</div>`;'''

text_html = text_html.replace(old_rating, new_rating)
p_html.write_text(text_html, encoding='utf-8')
print("Fixes 2 aplicados")
