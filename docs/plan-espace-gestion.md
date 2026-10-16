# Plan — Espace de gestion du bureau (compta, matériel, SumUp, HelloAsso)

Statut : **brouillon à valider**. Aucun code tant que ce plan n'est pas validé.
Date : 16/10/2026.

## 1. Objectif et périmètre

Donner au bureau du Club Quisine (les 5 comptes `admin`) un espace de gestion privé dans `/admin` :

- **Compta** : une vraie comptabilité associative en partie double, avec justificatifs (tickets, factures), clôture d'exercice et exports Excel pour le bilan et l'AG.
- **SumUp** : import automatique des encaissements du terminal de paiement.
- **HelloAsso** : import automatique des paiements (adhésions, dons, billetterie).
- **Matériel** : inventaire des ustensiles et équipements, contrôles d'inventaire pour repérer les pertes.
- **Tableau de bord** : vue d'ensemble de la trésorerie, des entrées récentes et des écarts d'inventaire.

Hors périmètre : la partie publique du site (recettes, équipe) ne change pas. Les membres simples ne voient rien de ces modules.

Contraintes :

- Seuls les `admin` y ont accès. Les clés SumUp et HelloAsso sont gérées par Enzo, uniquement côté serveur.
- Interface sobre et professionnelle : ni emoji, ni formulations « générées ».
- Niveau de sécurité d'un projet de club cyber : chaque route est protégée, validée, journalisée et testée (section 8).

## 2. Principes comptables retenus

Une association loi 1901 sans activité lucrative n'est pas obligée de tenir une compta d'engagement complète. Une compta en partie double, propre, rend pourtant le bilan trivial et tient face à un contrôle (école, banque, financeur). L'interface reste simple, et c'est la mécanique en dessous qui est rigoureuse.

- **Partie double** : chaque opération saisie (« recette », « dépense », « virement interne ») génère des écritures débit/crédit équilibrées. Le bureau ne manipule jamais de débits/crédits à la main, sauf en saisie avancée (OD).
- **Plan comptable associatif simplifié** (règlement ANC 2018-06), modifiable par le bureau. Comptes livrés par défaut :

| Compte | Libellé | Usage |
|---|---|---|
| 512 | Banque | compte bancaire de l'asso |
| 530 | Caisse | espèces |
| 5112 | SumUp — en attente de versement | encaissements terminal non encore versés en banque |
| 5113 | HelloAsso — en attente de versement | idem HelloAsso |
| 467 | Membres — avances à rembourser | paiement avancé par un membre |
| 601 | Achats de matières premières | ingrédients |
| 606 | Fournitures et petit matériel | ustensiles, consommables |
| 2154 | Matériel | gros équipement au-delà du seuil d'immobilisation |
| 6257 | Réceptions | événements |
| 627 | Frais bancaires et commissions | commissions SumUp |
| 706 | Prestations de services / ventes | repas hebdo, traiteur événements |
| 7541 | Dons manuels | dons HelloAsso ou autres |
| 756 | Cotisations | adhésions |
| 74 | Subventions | école, BDE, etc. |
| 86 / 87 | Contributions volontaires en nature | dons de matériel valorisés (optionnel) |

- **Journaux** : `VE` ventes, `AC` achats, `BQ` banque, `CA` caisse, `SU` SumUp, `HA` HelloAsso, `OD` opérations diverses.
- **Exercice** : dates configurables. C'est la **première année** de l'asso : le premier exercice commence à la date de la première opération bancaire (fin juillet, août ou septembre 2026, on le lira dans l'export Crédit Mutuel) et se termine au **31 août 2027**. Les suivants iront du 1er septembre au 31 août. Il n'y a pas de soldes d'ouverture à reprendre : tout l'historique bancaire est importé depuis l'ouverture du compte (section 3.2). Un seul exercice ouvert à la fois.
- **Montants** : entiers en **centimes**, jamais de flottants.
- **Pièces numérotées** séquentiellement par journal et par exercice (`AC-2026-0042`), sans trou.
- **Tout est corrigeable, rien ne s'efface en silence** : une opération est validée dès sa saisie. Ensuite, la corriger ou la supprimer passe par une **demande validée par un autre membre du bureau** (section 3.5). Techniquement, une correction approuvée ne réécrit pas l'ancienne écriture : le système passe une écriture inverse puis la nouvelle version, liées entre elles. L'historique reste donc complet et lisible pour l'auditeur, sans que le bureau ait à manipuler ces écritures inverses.
- **Clôture** : un exercice clôturé est verrouillé en écriture. La clôture génère les écritures de report à nouveau sur l'exercice suivant. Elle exige une double validation (section 3.5).

## 3. Module Compta

### 3.1 Écrans

1. **Opérations** : liste filtrable (période, journal, compte, catégorie, statut, avec ou sans justificatif, recherche texte) et total en bas de liste.
2. **Nouvelle opération** : un formulaire unique avec 3 modes.
   - *Recette* : date, montant, moyen d'encaissement (banque, caisse, SumUp, HelloAsso), catégorie (vente repas, événement, cotisation, don, subvention, autre), libellé, tiers optionnel, justificatif(s).
   - *Dépense* : date, montant, payé par (carte de l'asso, caisse, ou exceptionnellement **un membre**), catégorie (ingrédients, petit matériel, matériel, événement, frais, autre), libellé, fournisseur, justificatif(s) **obligatoire(s)** (exception possible, avec un motif saisi).
   - *Virement interne* : caisse → banque (dépôt d'espèces), SumUp → banque, HelloAsso → banque.
   - Saisie avancée : écriture libre multi-lignes (OD), contrôlée pour être équilibrée.
3. **Justificatifs** : photo prise directement depuis le téléphone (ticket de caisse) ou PDF. Plusieurs fichiers par opération. Aperçu intégré. Une liste « opérations sans justificatif » sert de file de travail.
4. **Caisse** (espèces, section 3.3).
5. **Import bancaire Crédit Mutuel** (section 3.2).
6. **Demandes à valider** : file des corrections et suppressions en attente (section 3.5).
7. **États** : balance, grand livre, journal, compte de résultat, bilan simplifié, sur l'exercice ou une période donnée.
8. **Paramètres** : plan comptable, catégories et leur compte associé, exercices, correspondance des formulaires HelloAsso avec les comptes.

### 3.2 Banque (Crédit Mutuel)

Il n'y a pas d'API bancaire. Les relevés exportés depuis l'espace Crédit Mutuel, en CSV (point-virgule, décimales à virgule ; format exact à confirmer sur un vrai fichier), alimentent la compta.

- **Premier import = point de départ de la compta** : on importe tout l'historique depuis l'ouverture du compte. Toutes les opérations passées entrent d'un coup.
- Écran d'import en 3 étapes :
  1. **Aperçu** du fichier.
  2. **Rapprochement automatique** des lignes avec ce qui existe déjà : versements SumUp et HelloAsso, dépenses saisies à la main avec le même montant à quelques jours près.
  3. **Catégorisation rapide** des lignes restantes : sélection multiple, catégorie, libellé. Des règles simples (« libellé contient METRO → ingrédients ») sont proposées.
- Dédoublonnage : une ligne déjà importée n'est jamais réimportée (empreinte date + montant + libellé + rang dans la journée). On peut donc réimporter un relevé qui chevauche le précédent sans risque.
- Les imports suivants sont **occasionnels** (avant l'AG, avant la clôture). Entre deux imports, les dépenses carte sont saisies au fil de l'eau avec la photo du ticket, et le prochain import les rapproche.
- **Solde constaté** : à tout moment, on peut saisir le solde affiché dans l'appli Crédit Mutuel. L'écart avec le solde comptable s'affiche, sans avoir à importer quoi que ce soit.

### 3.3 Caisse (espèces)

- Saisie d'un **mouvement de caisse avec un montant signé** : `+20,00` = entrée, `-12,50` = sortie. On renseigne aussi la date, le motif, la catégorie (vente, achat, dépôt en banque, autre) et un justificatif facultatif.
- L'interface affiche clairement le sens (« Entrée de 20,00 € » / « Sortie de 12,50 € ») avant d'enregistrer, pour éviter les erreurs de signe.
- Comptablement : une entrée débite 530 et crédite le compte de la catégorie, une sortie fait l'inverse. Un dépôt en banque est un virement interne 530 → 512.
- **Comptage de caisse** : on saisit l'argent réellement présent dans la caisse. L'écart avec le solde théorique s'affiche. Il peut être régularisé, avec un motif et une double validation.
- Le solde de caisse ne peut pas devenir négatif : la saisie est refusée, avec un message clair.

### 3.4 Remboursement d'un membre

Le cas est unique pour l'instant : un paiement fait avec la carte de Damien. Pas de module « notes de frais » complet, seulement :

- l'option « payé par un membre » sur une dépense, qui crée une dette envers ce membre (compte 467) ;
- un bouton « marquer comme remboursé », qui crée l'opération bancaire liée ;
- une ligne « à rembourser » dans le tableau de bord tant que ce n'est pas soldé.

À faire une fois le cœur de la compta en place, comme prévu.

### 3.5 Double validation (principe des quatre yeux)

Objectif : on peut presque tout corriger, mais **jamais seul** et **jamais par mégarde**.

**Ce qui se fait directement** (un seul membre du bureau) :

- Saisir une opération, un mouvement de caisse, un justificatif.
- Les imports SumUp, HelloAsso et bancaires, **validés automatiquement**.
- **Corriger sa propre saisie dans les 15 minutes** qui suivent (faute de frappe juste après l'enregistrement). Passé ce délai, ou pour la saisie de quelqu'un d'autre, il faut une demande.
- Ajouter un justificatif à une opération existante.

**Ce qui exige une demande validée par un autre membre du bureau** :

- Modifier une opération déjà enregistrée (montant, date, compte, catégorie), y compris une opération importée de SumUp, HelloAsso ou de la banque.
- Supprimer (annuler) une opération ou retirer un justificatif.
- Régulariser un écart de caisse ou de banque.
- Modifier le plan comptable, les catégories ou la correspondance HelloAsso.
- Clôturer un exercice.
- Donner ou retirer le rôle admin, ajouter ou retirer un email admin de la liste blanche.
- Supprimer une fiche matériel ou corriger une quantité en dehors d'un contrôle d'inventaire.

**Fonctionnement d'une demande** :

1. Le demandeur ouvre l'opération, clique sur « Demander une modification » ou « Demander la suppression », fait ses changements et saisit un **motif obligatoire**.
2. L'opération est marquée « modification en attente » ; l'original reste en vigueur.
3. Les autres membres du bureau la voient dans « À valider », avec la comparaison **avant / après** champ par champ (et sur le tableau de bord ; email optionnel).
4. Un **autre** membre approuve ou refuse, avec un commentaire facultatif. Le serveur refuse que le demandeur valide sa propre demande, quelle que soit la requête envoyée.
5. À l'approbation, le changement est appliqué dans une transaction. Si l'opération a été modifiée entre-temps, l'approbation est refusée et une nouvelle demande est nécessaire.
6. Une demande non traitée expire au bout de 14 jours. Le demandeur peut l'annuler.
7. Tout est tracé dans le journal d'audit : demande, décision, auteur, motif.

**Garde-fous contre les fausses manipulations** :

- Les boutons de suppression ne sont jamais à côté des boutons d'action courants. Ils mènent à un formulaire de demande, jamais à une suppression immédiate.
- Avant d'enregistrer, un récapitulatif apparaît quand le montant est inhabituel (au-delà de 500 €, à régler), quand la date est hors de l'exercice ou dans le futur, ou quand une opération ressemble à un doublon (même montant, même jour).
- Pas de suppression en masse.

### 3.6 Exports Excel (.xlsx)

Générés côté serveur, un classeur multi-onglets par export :

- **Dossier de bilan** (un clic) : compte de résultat, bilan simplifié, balance, grand livre, journal, liste des opérations avec un lien vers chaque justificatif, dettes envers les membres, historique des corrections approuvées, inventaire du matériel valorisé.
- Exports unitaires de chaque état, sur une période libre.
- Format : montants en euros (cellules numériques, pas de texte), dates au format Excel, en-têtes figés, filtres automatiques, totaux par formule.
- **Protection contre l'injection de formules** : toute cellule texte commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot est préfixée par `'` (section 8).
- Option plus tard : archive ZIP « dossier de bilan + tous les justificatifs ».

Bibliothèque : `exceljs` côté backend (à revalider au moment du développement : maintenance, audit des dépendances). Le paquet npm `xlsx` est exclu car sa version npm n'est plus maintenue.

## 4. Intégrations de paiement

Principes communs :

- Les clés API vivent **uniquement** dans le SealedSecret Kubernetes, jamais en base, jamais envoyées au front, jamais dans les logs.
- Chaque transaction externe est stockée brute (`external_transaction`) avec son identifiant fournisseur en **clé unique**. Une nouvelle synchronisation est donc toujours sans effet de bord (idempotente).
- Chaque transaction importée génère automatiquement une **écriture validée**. Si elle est fausse (mauvaise catégorie, par exemple), on la corrige ou la supprime par une demande à double validation (section 3.5). Une transaction supprimée de la compta reste dans `external_transaction` avec le statut « écartée », ce qui évite qu'une prochaine synchro la réimporte.
- Le tableau de bord montre l'état de chaque intégration : dernière synchro réussie, dernière erreur, nombre de transactions importées.
- Bouton « synchroniser maintenant » (admin, limité en fréquence).

### 4.1 SumUp

- **API** : clé API marchand (compte d'Enzo), `GET /v2.1/merchants/{merchant_code}/transactions/history` pour les transactions, endpoint des versements (payouts) pour les virements vers la banque et les commissions. Endpoints exacts et droits de la clé à confirmer sur la doc et le compte au démarrage de la phase.
- **Pas de webhook** pour les paiements au terminal : la synchro se fait par **CronJob Kubernetes** toutes les 15 minutes (et à la demande).
- **Écritures générées** :
  - Vente : débit 5112 / crédit 706 (montant brut).
  - Commission : débit 627 / crédit 5112.
  - Versement : débit 512 / crédit 5112.
  - Remboursement client : contre-écriture.
- Les transactions `FAILED` ou annulées sont stockées mais ne génèrent pas d'écriture.
- Rattachement optionnel d'une vente à un **service** (le repas de la semaine), pour suivre le chiffre d'affaires par service.

### 4.2 HelloAsso

- **API v5** : jeton OAuth2 `client_credentials` (gardé en mémoire et renouvelé automatiquement), endpoints organisation `club-quisine` : paiements, commandes, formulaires.
- **Webhook** HelloAsso (Order / Payment) pour l'instantané, **plus** une synchro de rattrapage quotidienne par CronJob au cas où un webhook serait perdu.
- **Le webhook n'est jamais cru sur parole** : on n'utilise que l'identifiant reçu, puis on **relit le paiement via l'API** avant d'écrire quoi que ce soit (section 8.5).
- **Écritures générées** selon le type de formulaire, avec une correspondance configurable :
  - Adhésion : débit 5113 / crédit 756.
  - Don : débit 5113 / crédit 7541.
  - Billetterie ou boutique : débit 5113 / crédit 706.
  - Versement HelloAsso vers la banque : débit 512 / crédit 5113.
- Option : créer ou mettre à jour une fiche **adhérent** à partir des adhésions (nom, email, date, montant). À valider : cela fait entrer des données personnelles (section 8.9).
- Développement et tests sur l'environnement **sandbox** de HelloAsso avant la prod.

### 4.3 Notifications de nouvelles entrées

- Fil « dernières entrées » sur le tableau de bord (SumUp et HelloAsso).
- Option : un email récapitulatif au bureau (instantané ou quotidien) via l'`email-service` Zenix existant (authentification JWT RS256 déjà en place).

## 5. Module Matériel

Objectif : savoir ce qu'on possède et détecter ce qui disparaît. Pas de gestion de lieu.

### 5.1 Fiche matériel

- Nom, catégorie (ustensiles, couteaux, casseroles et poêles, électroménager, vaisselle, contenants, autre), photo optionnelle.
- **Quantité attendue** : ce qu'on est censé avoir.
- État : neuf, bon, usé, hors service.
- **Provenance** : achat ou **don**.
  - Achat : date d'achat (optionnelle), prix unitaire (optionnel), **lien optionnel vers la dépense en compta**.
  - Don : donateur (optionnel), date, valeur estimée (optionnelle). Si elle est valorisée, le don peut être passé en contribution volontaire en nature (comptes 86/87).
- Notes.
- Une fiche n'est jamais supprimée : elle est **sortie de l'inventaire** avec un motif (perdu, cassé, jeté, donné) et une date. L'historique est conservé.

### 5.2 Mouvements

Journal de tous les mouvements d'une fiche : ajout, achat complémentaire, perte, casse, mise au rebut, retrouvé, correction après inventaire. Pour chacun : qui, quand, quantité, motif.

### 5.3 Contrôles d'inventaire

- Démarrer un contrôle daté : la liste de tout le matériel s'affiche, on saisit la **quantité comptée** pour chaque ligne (pratique sur téléphone, en cuisine).
- À la validation, les **écarts** apparaissent (attendu, compté, différence). Pour chaque écart, on choisit entre « perdu », « cassé » ou « à recompter ». Les mouvements correspondants sont générés.
- Historique des contrôles et comparaison avec le précédent.
- Le tableau de bord affiche le matériel manquant au dernier contrôle, la date du dernier contrôle, et le matériel hors service à remplacer.

## 6. Tableau de bord

Page d'accueil de `/admin`, sobre :

- **Trésorerie** : solde banque, caisse, SumUp en attente, HelloAsso en attente, et total.
- **Exercice en cours** : produits, charges, résultat, comparés à la même date de l'exercice précédent.
- **Encaissements par semaine** : barres sur 12 semaines, ventilées SumUp / HelloAsso / autres.
- **Dernières entrées** : 10 dernières transactions importées.
- **À traiter** : demandes en attente de ma validation, mes demandes en cours, opérations sans justificatif, membres à rembourser, écart de caisse ou de banque, erreurs de synchro.
- **Matériel** : date du dernier contrôle, nombre d'articles manquants, hors service.

Graphiques en SVG fait maison (pas de bibliothèque lourde, compatible avec la CSP actuelle `script-src 'self'`). La charte reste celle du site (crème, orange, brun), en plus dense pour le back-office : tableaux, icônes SVG au trait, pas d'emoji.

## 7. Architecture technique

### 7.1 Base de données

Les nouvelles tables vont dans `quisine_db` (Galera). Toutes les clés primaires sont en UUID, les montants en `BIGINT` centimes, les dates en `DATE` ou `DATETIME(3)` UTC.

| Table | Rôle |
|---|---|
| `fiscal_year` | exercices (début, fin, statut ouvert/clôturé, clôturé par/le) |
| `account` → **renommée `ledger_account`** | plan comptable (`account` est déjà prise par Better Auth) |
| `journal` | journaux |
| `category` | catégories métier → compte |
| `entry` | pièce comptable (journal, numéro, date, libellé, statut active/annulée/remplacée, source manuelle/sumup/helloasso/banque/caisse, auteur, version, liens vers l'écriture inverse et la version suivante) |
| `entry_line` | lignes débit/crédit (compte, montant, libellé) |
| `attachment` | justificatifs (clé objet privée, type, taille, empreinte SHA-256, téléversé par/le) |
| `member_debt` | dettes envers un membre (membre, entrée d'origine, entrée de remboursement, statut) |
| `change_request` | demandes à double validation (type, cible, version de la cible, changements proposés, motif, demandeur, statut, validateur, décision, expiration) |
| `bank_import` / `bank_line` | imports Crédit Mutuel et leurs lignes (empreinte **unique**, entrée rapprochée) |
| `categorization_rule` | règles « libellé contient X → catégorie Y » |
| `balance_check` | soldes constatés banque et comptages de caisse (date, montant réel, écart, auteur) |
| `external_transaction` | brut SumUp/HelloAsso (fournisseur, id externe **unique**, payload JSON, statut, entrée liée) |
| `integration_state` | curseur de synchro, dernière réussite, dernière erreur |
| `equipment` | fiches matériel |
| `equipment_movement` | mouvements |
| `inventory_check` / `inventory_check_line` | contrôles d'inventaire |
| `audit_log` | journal d'audit, en ajout seul |

Garde-fous **au niveau de la base**, et pas seulement dans le code :

- Triggers `BEFORE UPDATE/DELETE` sur `entry` et `entry_line` :
  - `DELETE` toujours refusé, puisqu'une annulation passe par une écriture inverse ;
  - modification des montants, comptes et dates autorisée seulement dans les 15 minutes après la création ; au-delà, seuls les champs de statut et de liens peuvent changer ;
  - toute écriture est refusée si l'exercice est clôturé.
- La règle « le demandeur ne valide pas sa propre demande » est appliquée dans le service et doublée d'une contrainte `CHECK (decided_by <> requested_by)` sur `change_request`.
- Trigger qui interdit `UPDATE`/`DELETE` sur `audit_log`.
- Équilibre débit = crédit vérifié en transaction applicative à la validation (un trigger multi-lignes n'est pas fiable sous Galera).
- Galera : toutes les tables en InnoDB avec clé primaire (obligatoire pour la réplication), transactions courtes, gestion des erreurs de certification (deadlock) en retentant une fois.

### 7.2 Migrations

Le script actuel (`CREATE TABLE IF NOT EXISTS`) ne sait pas faire évoluer un schéma. Il est remplacé par des **migrations versionnées Kysely** (Kysely est déjà une dépendance via Better Auth) : un fichier par migration, une table de suivi, et un rollback possible.

L'exécution passe par un **Job Helm `PreSync`** (hook ArgoCD) qui lance les migrations avant le déploiement du backend. Plus aucune migration manuelle.

### 7.3 Backend

- Nouveaux routeurs, montés sous `/api/admin/` avec `requireAdmin` au niveau du routeur :
  `/api/admin/compta/*`, `/api/admin/materiel/*`, `/api/admin/integrations/*`, `/api/admin/dashboard`, `/api/admin/exports/*`.
- Route publique unique : `POST /api/webhooks/helloasso/:token` (section 8.5).
- Validation de toutes les entrées avec **zod** (schémas stricts, clés inconnues refusées).
- Couche service séparée des routes : la logique comptable (génération d'écritures, numérotation, clôture) est testable sans HTTP.
- **Worker de synchro** : même image que le backend, autre point d'entrée (`node jobs/sync.js sumup|helloasso`), lancé par des **CronJobs** Kubernetes. Aucun port exposé.
- Justificatifs : **bucket R2 privé distinct** (pas le CDN public `cdn.zenixweb.fr`).

### 7.4 Frontend

- `/admin` devient une mise en page back-office : barre latérale (Tableau de bord, Compta, Matériel, Intégrations, puis les onglets existants Recettes, Équipe, Comptes, Emails autorisés) et sous-routes `/admin/compta/operations`, etc.
- Le routage par `if` d'`App.jsx` est remplacé par un petit routeur (`wouter`, environ 2 ko, ou un routeur maison de quelques lignes).
- Pages admin chargées à la demande (lazy), déjà le cas aujourd'hui.
- Version mobile soignée pour deux usages terrain : prendre un ticket en photo et faire un contrôle d'inventaire.

### 7.5 Déploiement

- Helm : 2 CronJobs (SumUp toutes les 15 min, HelloAsso une fois par jour), un Job de migration, de nouvelles clés dans le SealedSecret (`SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `HELLOASSO_CLIENT_ID`, `HELLOASSO_CLIENT_SECRET`, `HELLOASSO_ORG_SLUG`, `HELLOASSO_WEBHOOK_TOKEN`, et les identifiants du bucket privé R2).
- **NetworkPolicy** : les sorties du namespace `quisine` sont limitées à la base, à R2, à `api.sumup.com` et `api.helloasso.com`. À adapter au CNI de k3s PRO.
- Sauvegardes : vérifier que `quisine_db` est bien dans les sauvegardes Galera vers R2, que le bucket des justificatifs est sauvegardé ou versionné, et faire **un test de restauration** avant la mise en prod de la compta.

## 8. Sécurité

### 8.1 Authentification et autorisation

- Refus par défaut : toute route sous `/api/admin/` passe par `requireAdmin` au niveau du routeur, jamais route par route.
- **Test automatique** qui énumère toutes les routes Express enregistrées et vérifie qu'un visiteur non connecté reçoit 401 et qu'un `membre` reçoit 403 sur chaque route admin. Si une route est ajoutée sans protection, la CI échoue.
- Le rôle n'est jamais lu depuis le client (déjà corrigé en v1.4.2 avec `input: false`) ; on garde la revalidation de la liste blanche à chaque session.
- **Réauthentification récente** (connexion de moins de 10 minutes) exigée pour valider une demande à double validation, demander une clôture d'exercice et exporter le dossier complet.
- **Double validation appliquée côté serveur** (section 3.5) : les routes de modification directe d'un objet validé n'existent tout simplement pas, seule la création d'une demande est exposée. Des tests vérifient qu'un admin ne peut pas valider sa propre demande, qu'une demande expirée ou visant une version périmée est refusée, et qu'aucune route ne modifie une opération de plus de 15 minutes sans passer par une demande.
- Changement de rôle et ajout d'un email admin dans la liste blanche passent aussi par la double validation : un compte admin compromis ne peut pas créer seul un autre admin.
- Sessions admin : durée réduite et invalidation de toutes les sessions d'un utilisateur quand il est retiré de la liste blanche.

### 8.2 CSRF et origine

- Un middleware vérifie `Origin` (et à défaut `Referer`) sur toute requête non-GET hors webhooks : seule l'origine `quisine.zenixweb.fr` est acceptée.
- Les requêtes de modification doivent être en `Content-Type: application/json` (ce qui écarte les formulaires HTML cross-site).
- Cookies Better Auth : `Secure`, `HttpOnly`, `SameSite=Lax`, à vérifier en prod.

### 8.3 Validation et données

- Schéma zod strict par route (body, params, query), avec des bornes : montant entre 1 centime et 1 000 000 €, dates dans l'exercice, longueurs maximales.
- Uniquement des requêtes SQL paramétrées (déjà le cas), jamais de concaténation, y compris pour les tris et filtres (liste blanche de colonnes).
- Contrôle d'accès vérifié au niveau de chaque objet, même si tous les admins voient tout aujourd'hui : on ne relâche pas la vérification.

### 8.4 Limitation de débit

- La limite globale actuelle (100 requêtes / 15 min / IP) est **conservée pour le public** mais **remplacée pour les admins** par une limite par utilisateur plus large (par exemple 600 / 15 min).
- Limites dédiées : téléversement (30 / 15 min), export (10 / 15 min), « synchroniser maintenant » (1 / min), webhook (60 / min).

### 8.5 Webhook HelloAsso

- URL contenant un jeton secret aléatoire de 256 bits, comparé en temps constant (`timingSafeEqual`).
- Corps limité à 64 ko, JSON uniquement.
- Le contenu du webhook n'est **jamais** utilisé directement : on n'en extrait que l'identifiant, puis on relit la ressource via l'API HelloAsso authentifiée. Un faux webhook ne peut donc rien créer.
- Traitement idempotent (clé unique), réponse 200 rapide, journalisation sans données personnelles.
- Option : liste blanche des IP sources HelloAsso au niveau de Traefik, si HelloAsso les publie (à vérifier).
- Ce que HelloAsso fournit exactement pour signer ses webhooks est **à vérifier** au démarrage de la phase : s'il existe une signature, on la vérifie en plus.

### 8.6 Justificatifs (fichiers)

- Téléversement **via le backend** (pas d'URL présignée directe comme pour les images publiques), pour pouvoir contrôler le contenu.
- Taille maximale de 10 Mo. Types autorisés : JPEG, PNG, WebP, HEIC (photos d'iPhone, converties ou refusées selon le choix final) et PDF, vérifiés par les **octets d'en-tête du fichier**, pas par l'extension.
- Nom de stockage aléatoire (UUID). Le nom d'origine est stocké en base seulement, après nettoyage.
- Métadonnées EXIF retirées des photos (géolocalisation du téléphone).
- Empreinte SHA-256 stockée : intégrité et détection des doublons.
- Lecture uniquement par une route admin qui génère une URL présignée **GET de 60 secondes**, avec `Content-Disposition: attachment` pour les PDF, ou par un passage via le backend.
- Bucket privé : aucun accès public, clé R2 limitée à ce bucket.

### 8.7 Exports Excel

- Neutralisation de l'injection de formules (section 3.6) sur **toutes** les cellules texte, y compris les libellés venant de SumUp et HelloAsso (noms de clients, intitulés de formulaires).
- Génération à la volée, en flux : rien n'est stocké sur disque, rien n'est publié.
- Chaque export est tracé dans le journal d'audit.

### 8.8 Journal d'audit

- Chaque action de modification (compta, matériel, intégrations, rôles, liste blanche) écrit une ligne : qui, quand, IP, action, objet, avant/après (JSON).
- En ajout seul, protégé par trigger. Consultable par le bureau dans un onglet « Historique ».
- Les connexions et échecs d'autorisation (401/403 sur `/api/admin`) sont aussi journalisés pour repérer les tentatives.

### 8.9 Données personnelles (RGPD)

- Données concernées : nom et email des adhérents ou payeurs HelloAsso, membres à rembourser.
- Minimisation : on ne garde du payload que ce qui sert à la compta. Le payload brut est purgé au bout d'une durée à fixer.
- Les pièces comptables sont conservées 10 ans (obligation de conservation). Les autres données personnelles ont une durée de conservation plus courte, à définir.
- Mettre à jour les mentions légales et la politique de confidentialité si on stocke des données d'adhérents.

### 8.10 Chaîne de build et exploitation

- Déjà en place, à conserver : actions épinglées par SHA, `pnpm audit --prod`, Trivy, image sans npm, utilisateur non-root, `minimum-release-age`.
- À ajouter : tests (logique comptable, autorisations, webhook, exports) exécutés dans la CI et bloquants, analyse statique (`eslint-plugin-security` ou Semgrep), en-têtes de sécurité vérifiés sur les nouvelles routes.
- Les logs pino ne contiennent ni clé, ni jeton, ni cookie, ni payload de paiement complet (masquage configuré).

## 9. Découpage en livraisons

Chaque phase = une PR relue, testée et déployée.

| Phase | Contenu | Dépend de |
|---|---|---|
| **0. Fondations** | migrations Kysely + Job PreSync, zod, vérification d'origine, limites par utilisateur, `audit_log`, test d'autorisation automatique, nouvelle mise en page `/admin` + routeur, bucket privé + route justificatifs, **mécanisme de double validation générique** (`change_request`) | — |
| **1. Matériel** | fiches, mouvements, contrôles d'inventaire, encart tableau de bord | 0 |
| **2. Compta, cœur** | plan comptable, exercices, journaux, opérations recette/dépense/virement, caisse à montant signé, justificatifs, corrections et suppressions par demande, triggers | 0 |
| **3. Import Crédit Mutuel** | import CSV, rapprochement automatique, catégorisation rapide et règles, solde constaté ; premier import de tout l'historique | 2 |
| **4. États et exports** | balance, grand livre, compte de résultat, bilan, exports Excel, dossier de bilan | 2 |
| **5. HelloAsso** | client API, webhook, synchro de rattrapage, correspondance formulaires → comptes, sandbox | 2 |
| **6. SumUp** | client API, CronJob, ventes, commissions, versements, rapprochement | 2 |
| **7. Remboursement membre + tableau de bord complet** | dette envers Damien et son remboursement, indicateurs, graphiques, fil des entrées, emails optionnels | 1 à 6 |
| **8. Clôture d'exercice** | clôture avec double validation, report à nouveau, verrouillage (utile au plus tard fin août 2027) | 4 |

Le lien entre matériel et dépense (phase 1 ↔ 2) est ajouté dès que les deux existent.

## 10. Décisions prises (16/10/2026)

- Banque : **Crédit Mutuel**, pas d'API. Un import CSV complet au départ, puis des imports occasionnels.
- Caisse : oui, saisie à montant positif ou négatif.
- Exercice : première année de l'asso. Démarrage à la première opération (été 2026), fin au 31 août 2027.
- Paiements : carte de l'asso. Un seul remboursement de membre à prévoir (Damien), à traiter après le cœur de la compta.
- Imports SumUp et HelloAsso : validés automatiquement, avec correction ou suppression soumise à la validation d'un autre membre du bureau.
- Principe général : tout est corrigeable, rien ne se fait seul, tout est tracé.

## 11. Questions encore ouvertes

1. **Correction de sa propre saisie** : le délai de 15 minutes sans double validation te va-t-il ? On peut le réduire ou le supprimer.
2. **Matériel** : faut-il la double validation seulement pour supprimer une fiche et corriger une quantité hors inventaire (proposé), ou aussi pour les modifications simples (nom, photo, état) ?
3. **Inventaire** : seul le bureau fait les contrôles, ou faut-il ouvrir la saisie des comptages à des membres ?
4. **Adhérents** : veut-on une liste des adhérents à partir de HelloAsso, ou seulement la compta ?
5. **Notifications** : email aux autres membres du bureau quand une demande attend leur validation (proposé), et pour les nouvelles entrées : à chaque fois, en résumé quotidien, ou rien ?
6. **Seuil d'immobilisation** : à partir de quel prix un matériel passe en immobilisation (2154) plutôt qu'en charge (606) ? Proposé : 500 €.
7. **Export Crédit Mutuel** : m'envoyer un export d'exemple (même avec quelques lignes, ou anonymisé) pour caler le format avant la phase 3.

## 12. Avancement

### Phase 0 — Fondations (branche `feat/gestion-fondations`)

Fait :

- Migrations versionnées Kysely (`backend/migrations/`), lancées par le Job Helm `cuisine-migrate` (hook ArgoCD PreSync). `0001` reprend le schéma existant (sans effet sur la prod), `0002` crée `audit_log` et `change_request`.
- Connexions MariaDB forcées en UTC.
- Validation zod (`middleware/validate.js`), contrôle d'origine + JSON obligatoire sur toute modification (`middleware/origin.js`), erreurs centralisées (`lib/errors.js`).
- Limites de débit : publique par IP inchangée, admin par IP (1500 / 15 min) et par compte (600 / 15 min).
- Journal d'audit en ajout seul (triggers), écrit dans la même transaction que l'action.
- Double validation générique (`services/changeRequests.js`) et premiers types : changement de rôle, ajout/retrait d'un admin, suppression d'un compte admin. Minimum 2 admins garanti. Connexion de moins de 10 min exigée pour valider. Rétrograder ou retirer quelqu'un ferme ses sessions.
- Correction au passage : changer un rôle dans « Comptes » était annulé à la connexion suivante (le rôle effectif vient de `allowed_email`). Les deux sont maintenant mis à jour ensemble.
- Front : espace `/admin` avec barre latérale, tableau de bord, demandes à valider (avant/après), historique.
- Tests : autorisation de toutes les routes (sans base) + double validation, triggers et CHECK contre MariaDB 11.8 (CI : service MariaDB).

À vérifier sur Galera avant le premier déploiement :

1. `SHOW VARIABLES LIKE 'log_bin';` — si `ON`, mettre `log_bin_trust_function_creators = 1` sur les 3 nœuds (sinon la migration 0002 échoue : création de triggers sans SUPER).
2. `SHOW GRANTS FOR` l'utilisateur de `quisine_db` : il doit avoir `TRIGGER` et `CREATE`/`ALTER` sur la base.
3. Au moins 2 admins dans `allowed_email` (déjà le cas : 5).

### Phase 2 — Compta, cœur (même branche)

Fait :

- Migration `0003_compta` : exercices, plan comptable associatif simplifié, catégories, pièces (`entry`), lignes débit/crédit en centimes, justificatifs. Premier exercice : 30/05/2026 (ouverture du compte) → 31/08/2027.
- Triggers : une pièce ne se supprime jamais ; montants, dates et comptes figés 16 min après la saisie ; rien ne bouge dans un exercice clôturé ; un justificatif ne se modifie ni ne se supprime.
- Saisie : recette, dépense (ventilable sur plusieurs catégories), virement interne ; numérotation par journal (`BQ-2026-0001`) ; solde de caisse jamais négatif ; récapitulatif avant enregistrement avec alerte doublon / date future / gros montant.
- Corrections : l'auteur corrige seul pendant 15 min ; ensuite, correction, annulation et retrait de justificatif passent par une demande à double validation, appliquée par écriture inverse + nouvelle version.
- Justificatifs stockés en base (pas de bucket public), type vérifié sur les octets, photos réencodées côté navigateur (EXIF/GPS retirés), lecture réservée au bureau, servis avec une CSP sans script.
- Caisse : saisie à montant signé (+ entrée, - sortie), sens affiché en toutes lettres, dépôt en banque en un clic.
- Import de lot (`quisine-lot`, JSON) : aperçu, tout-ou-rien, idempotent (référence unique par opération), connexion récente exigée. Sert à la reprise de l'historique ; les fichiers de lot restent hors du dépôt (données bancaires).
- nginx : 9 Mo max sur `/api/`, 40 Mo sur la seule route d'import.

Reste pour plus tard : import CSV Crédit Mutuel direct (phase 3), exports Excel (phase 4), HelloAsso, SumUp, clôture.

### Ajouts du 16/10/2026

- Catégories au vocabulaire du bureau, regroupées en rentrées (adhésion, don, paiement, subvention…) et sorties (courses, matériel, Crédit Mutuel, frais bancaires…), filtre par catégorie et « remboursement de membre ».
- Remboursement d'une avance de membre (virement vers membre, compte 467).
- Adhérents : liste, ajout, modification, suppression, par saison et moyen de paiement (HelloAsso, SumUp, virement, espèces).
- Événements (hors compta) : opérations rattachées, montant affecté facultatif, rentrées - dépenses = résultat ; suivent les corrections et annulations.
- Accès API vérifiés : HelloAsso (User-Agent obligatoire, sinon 403) et SumUp (transactions, versements). Intégrations automatiques à coder.
