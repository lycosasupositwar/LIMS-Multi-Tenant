import fs from 'fs';
let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

const target = `                      {[
                        { label: "ID Demande", tag: "{{demande.id}}" },
                        { label: "Date de création", tag: "{{date.jour}}" },
                        { label: "Demandeur - Nom", tag: "{{demandeur.nom}}" },
                        { label: "Demandeur - Email", tag: "{{demandeur.email}}" },
                        { label: "Demandeur - Entreprise", tag: "{{demandeur.entreprise}}" },
                        { label: "Échantillon - ID", tag: "{{echantillon.id}}" },
                        { label: "Échantillon - Code Barre", tag: "{{echantillon.barcode}}" },
                        { label: "Échantillon - Matériau", tag: "{{echantillon.materiau}}" },
                        { label: "Échantillon - Projet", tag: "{{echantillon.projet}}" },
                        { label: "Analyse - Nom", tag: "{{analyse.nom}}" },
                        { label: "Analyse - Norme", tag: "{{analyse.norme}}" },
                        { label: "Analyse - Technicien", tag: "{{analyse.technicien}}" },
                        { label: "Résultats - Tableau", tag: "{{resultats.tableau}}" },
                        { label: "Images - Galerie", tag: "{{images.galerie}}" },
                        { label: "Remarques", tag: "{{analyse.remarques}}" }

                      ].map(v => (`

const replacement = `                      {[
                        { label: "ID Demande", tag: "{{demande.id}}" },
                        { label: "Date de création", tag: "{{date.jour}}" },
                        { label: "Demandeur - Nom", tag: "{{demandeur.nom}}" },
                        { label: "Demandeur - Email", tag: "{{demandeur.email}}" },
                        { label: "Demandeur - Entreprise", tag: "{{demandeur.entreprise}}" },
                        { label: "Échantillon - ID", tag: "{{echantillon.id}}" },
                        { label: "Échantillon - Code Barre", tag: "{{echantillon.barcode}}" },
                        { label: "Échantillon - Matériau", tag: "{{echantillon.materiau}}" },
                        { label: "Échantillon - Projet", tag: "{{echantillon.projet}}" },
                        { label: "Analyse - Nom", tag: "{{analyse.nom}}" },
                        { label: "Analyse - Norme", tag: "{{analyse.norme}}" },
                        { label: "Analyse - Technicien", tag: "{{analyse.technicien}}" },
                        { label: "Résultats - Tableau", tag: "{{resultats.tableau}}" },
                        { label: "Images - Galerie", tag: "{{images.galerie}}" },
                        { label: "Remarques", tag: "{{analyse.remarques}}" },
                        // Custom fields for Request
                        ...requestTemplates.flatMap(tpl => tpl.fields.map(f => ({
                           label: \`Demande: \${f.name}\`,
                           tag: \`{{demande.custom.\${f.id}}}\`
                        }))),
                        // Custom fields for Material
                        ...materialTemplates.flatMap(tpl => tpl.fields.map(f => ({
                           label: \`Échantillon: \${f.name}\`,
                           tag: \`{{echantillon.custom.\${f.id}}}\`
                        })))
                      ].reduce((unique, o) => {
                          if(!unique.some(obj => obj.tag === o.tag)) {
                            unique.push(o);
                          }
                          return unique;
                      }, [] as {label: string, tag: string}[]).map(v => (`

code = code.replace(target, replacement);

fs.writeFileSync('src/views/BuilderCMS.tsx', code);
