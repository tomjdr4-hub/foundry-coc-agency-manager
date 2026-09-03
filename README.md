# Agency Manager - Appel de Cthulhu (Foundry VTT)

Module Foundry VTT (v13 minimum, compatible v14) pour gérer une campagne
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
  (tous les joueurs, ou une sélection précise) et un bouton "Montrer aux
  joueurs" qui pousse le document directement sur l'écran des joueurs ciblés
  (sans dépendre des permissions Foundry classiques du document source).
- **PNJ rencontrés** : le MJ glisse-dépose un Acteur du monde dans une partie
  pour l'ajouter à la liste des PNJ rencontrés, avec une note privée et une
  visibilité réglable par joueur (idéal pour ne révéler un PNJ qu'aux joueurs
  qui l'ont réellement rencontré).
- **Notes de partie** : un bouton ouvre un journal dédié à la partie, avec les
  droits d'écriture accordés automatiquement aux joueurs qui y ont accès -
  les joueurs y prennent leurs notes d'enquête via l'éditeur de journal natif
  de Foundry.

### Société d'investigateurs

- Le MJ crée une ou plusieurs sociétés (l'organisation à laquelle appartiennent
  les investigateurs).
- Chaque société peut avoir sa propre carte du monde (image importée par le
  MJ) sur laquelle on place des **bureaux** par simple clic.
- Chaque bureau a un nom, un lieu, une description, une image et une liste de
  PNJ affectés (glisser-déposer un Acteur).
- La visibilité de chaque bureau est réglable par joueur, comme pour les
  handouts et les PNJ.

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
que pour les joueurs. Il ouvre la fenêtre "Agence d'investigateurs" avec deux
onglets :

- **Parties** : liste des sessions à gauche, détail (handouts + PNJ + accès
  aux notes) à droite.
- **Société** : liste des sociétés à gauche, détail (carte + bureaux) à
  droite.

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
