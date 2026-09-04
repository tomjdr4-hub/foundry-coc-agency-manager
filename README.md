# Agency Manager - Appel de Cthulhu (Foundry VTT)

Module Foundry VTT (v14 uniquement) pour gérer une campagne
d'Appel de Cthulhu : handouts diffusés à la carte, suivi des PNJ rencontrés,
notes de joueurs, et simulation d'une société d'investigateurs avec ses
bureaux à travers le monde.

Générique : il ne dépend d'aucun système de jeu particulier (compatible avec
n'importe quelle fiche de PNJ, y compris les systèmes CoC7 non officiels).

Non affilié à Chaosium Inc. Projet fan, à but non commercial.

## Fonctionnalités

### Parties (sessions)

- Le MJ crée une partie par séance de jeu.
- **Handouts** : le MJ dépose des images ou lie des pages de journal
  existantes, classées par partie. Chaque handout a sa propre visibilité
  (tous les joueurs, ou une sélection précise). Un bouton "Consulter"
  (loupe), visible par tous ceux qui y ont accès, permet de le rouvrir
  soi-même à tout moment ; le bouton "Montrer aux joueurs" (œil), réservé au
  MJ, le pousse en plus directement sur l'écran des joueurs ciblés (sans
  dépendre des permissions Foundry classiques du document source).
- **PNJ rencontrés** : le MJ glisse-dépose un Acteur du monde dans une partie
  pour l'ajouter à la liste des PNJ rencontrés, avec une note privée et une
  visibilité réglable par joueur (idéal pour ne révéler un PNJ qu'aux joueurs
  qui l'ont réellement rencontré).
- **Notes de partie** : un bouton ouvre un journal dédié à la partie, avec les
  droits d'écriture accordés automatiquement aux joueurs qui y ont accès -
  les joueurs y prennent leurs notes d'enquête via l'éditeur de journal natif
  de Foundry.
- **Vignettes agrandissables** : cliquer sur l'image d'un PNJ, d'un handout,
  d'un membre du personnel/investigateur affecté ou d'un équipement l'ouvre
  en grand (localement, sans rien diffuser aux autres joueurs).
- **Notes personnelles par PNJ** : chaque joueur peut ouvrir, depuis la carte
  d'un PNJ, sa propre page de notes privée sur ce PNJ (bouton icône
  post-it). Cette page vit dans le journal de la partie mais n'est visible
  que par ce joueur et le MJ, même si d'autres joueurs ont accès au même
  journal.
- **Indicateur "Nouveau"** : un badge signale à chaque joueur les handouts et
  PNJ qu'il n'a pas encore vus dans sa propre fenêtre ; il disparaît
  automatiquement dès l'affichage. Le MJ voit en plus un compteur "x/y
  joueurs" sous chaque handout/PNJ.
- **Historique des révélations** : le MJ dispose, par partie, d'un journal
  listant qui a reçu quel handout et quand.
- **Scènes liées** : une partie peut être reliée à plusieurs scènes du monde ;
  le MJ peut activer l'une d'elles pour toute la table en un clic. Cette
  section est strictement réservée au MJ, les joueurs ne la voient jamais.

### Société d'investigateurs

- Le MJ crée une ou plusieurs sociétés (l'organisation à laquelle appartiennent
  les investigateurs).
- Chaque société peut avoir sa propre carte du monde (image importée par le
  MJ) sur laquelle on place des **bureaux** par simple clic.
- Chaque bureau a un nom, un lieu, une description, une image et une liste de
  PNJ affectés (glisser-déposer un Acteur).
- La visibilité de chaque bureau est réglable par joueur, comme pour les
  handouts et les PNJ.
- **Investigateurs affectés** : le MJ peut affecter un personnage-joueur à un
  bureau précis (glisser-déposer), pour représenter les postes/missions dans
  le monde. Un personnage n'est affecté qu'à un seul bureau à la fois.
- **Équipement commandable** : chaque société a un catalogue constitué en
  glissant-déposant de vrais Objets (Items) du monde ou d'un compendium (le
  nom et l'image viennent de l'Item). Les joueurs peuvent commander un
  article ; le MJ fixe librement un délai (texte libre, ex. "3 jours") et
  suit le statut de chaque commande (en attente/approuvée/refusée/reçue).

### Réseau de PNJ

Un onglet "Réseau", réservé au MJ, affiche un schéma visuel (bulles reliées
par des traits) de tous les PNJ suivis dans les parties et les bureaux, avec
les relations que le MJ définit entre eux (ex. "connaît", "rival de"). Les
joueurs ne voient jamais cet onglet.

### Date fictive et horloge de campagne

- Chaque partie peut avoir une **date/heure fictive** (ex. 1er avril 1925,
  12h00), réglable par le MJ et visible par les joueurs y ayant accès.
- Une **horloge de campagne** globale (icône dans l'en-tête) affiche et fixe
  la date/heure fictive courante du monde, avec des raccourcis "+1 heure" et
  "+1 jour" pour l'avancer rapidement. Réglable par le MJ, visible par tous.

### Chronologie de campagne

Un onglet "Chronologie" liste le récapitulatif de chaque partie visible par
le joueur (texte libre rédigé par le MJ dans le détail de la partie), avec sa
date fictive si elle est définie. Les parties datées sont triées par ordre
chronologique de fiction plutôt que par ordre de création.

### Recherche globale

Un champ de recherche dans l'en-tête de la fenêtre retrouve un handout, un
PNJ, un bureau ou un équipement par son nom, sur l'ensemble de la campagne, et
permet d'y sauter directement.

### Export / Import

Le MJ peut exporter toutes les données du module (parties, sociétés...) en un
fichier JSON (sauvegarde, transfert vers un autre monde), et les réimporter
(remplace intégralement les données actuelles, après confirmation).

### Visibilité par joueur

Presque tout (parties, handouts, PNJ, bureaux) porte une visibilité
indépendante : "Tous les joueurs" ou une sélection précise de joueurs. Les
joueurs ne voient dans leur propre fenêtre que ce qui leur est accordé ; le MJ
voit toujours tout, avec les contrôles d'édition.

## Installation

Manifeste : `https://raw.githubusercontent.com/tomjdr4-hub/foundry-coc-agency-manager/main/module.json`

Dans Foundry VTT : **Configuration et Modules > Installer un module**, collez
l'URL du manifeste ci-dessus.

## Utilisation

Un bouton dédié (icône <i class="fa-solid fa-user-secret"></i>) apparaît dans
les contrôles de la scène, à côté des outils de jeton, aussi bien pour le MJ
que pour les joueurs. Il ouvre la fenêtre "Agence d'investigateurs" avec
quatre onglets :

- **Parties** : liste des sessions à gauche, détail (handouts + PNJ + accès
  aux notes + scène liée) à droite.
- **Société** : liste des sociétés à gauche, détail (carte + bureaux +
  équipement) à droite.
- **Réseau** : schéma des PNJ suivis et de leurs relations.
- **Chronologie** : fil des récapitulatifs de chaque partie.

Accessible aussi via l'API : `game.modules.get("coc-agency-manager").api.open()`.

## Notes techniques

- Les données de campagne (parties, handouts, PNJ, sociétés, bureaux) sont
  stockées dans un unique paramètre de monde, modifiable uniquement par le
  MJ.
- La diffusion ciblée d'un handout ("Montrer aux joueurs") passe par un socket
  du module : chaque client reçoit l'ordre d'affichage et vérifie localement
  s'il fait partie des destinataires avant d'ouvrir la fenêtre.
- Les PNJ référencent de vrais Acteurs du monde (par UUID) : le module
  n'affiche que leur nom/image/lien vers la fiche, il ne duplique pas leurs
  données.
- La fenêtre se rafraîchit automatiquement pour tous les clients connectés dès
  que le MJ modifie les données (visibilité, ajout d'un handout ou d'un PNJ...),
  sans qu'un rechargement de page soit nécessaire côté joueur.
- La création de journal (notes de partie et notes personnelles par PNJ) et la
  commande d'équipement nécessitent des droits que les joueurs n'ont pas
  forcément par défaut : quand un joueur déclenche l'une de ces actions, la
  demande est relayée à un client MJ connecté qui l'exécute réellement (et,
  pour les notes, prévient ensuite le joueur pour ouvrir sa page). Si aucun MJ
  n'est connecté, le joueur est averti que la demande ne peut pas aboutir.
