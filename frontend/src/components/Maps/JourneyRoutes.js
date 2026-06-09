/**
 * Hardcoded biblical journey route data for the Atlas overlay feature.
 * Each route contains waypoints with coordinates, names, Bible references,
 * and event descriptions.
 */
export const JOURNEY_ROUTES = [
  {
    id: 'exodus',
    label: 'Exodus Route',
    color: '#f59e0b',
    description: 'Moses leading Israel from Egypt to Canaan (~1446 BC)',
    waypoints: [
      { lat: 30.06, lng: 31.25, name: 'Rameses (Goshen)', ref: 'Exodus 12:37', event: 'Israel departs Egypt' },
      { lat: 30.58, lng: 32.27, name: 'Succoth', ref: 'Exodus 12:37', event: 'First encampment' },
      { lat: 29.92, lng: 32.55, name: 'Etham', ref: 'Exodus 13:20', event: 'Edge of wilderness' },
      { lat: 30.02, lng: 32.75, name: 'Pi-hahiroth / Red Sea Crossing', ref: 'Exodus 14:2', event: 'Crossing the Red Sea' },
      { lat: 29.50, lng: 33.00, name: 'Marah', ref: 'Exodus 15:23', event: 'Bitter waters made sweet' },
      { lat: 29.12, lng: 33.10, name: 'Elim', ref: 'Exodus 15:27', event: '12 springs of water' },
      { lat: 28.54, lng: 33.59, name: 'Wilderness of Sin', ref: 'Exodus 16:1', event: 'Manna and quail given' },
      { lat: 28.70, lng: 33.97, name: 'Rephidim', ref: 'Exodus 17:1', event: 'Water from rock; battle with Amalek' },
      { lat: 28.54, lng: 33.97, name: 'Mount Sinai (Horeb)', ref: 'Exodus 19:1', event: 'Ten Commandments given' },
      { lat: 29.53, lng: 34.91, name: 'Kadesh Barnea', ref: 'Numbers 13:26', event: 'Spies return; 40-year wandering begins' },
      { lat: 30.93, lng: 35.45, name: 'Jericho', ref: 'Joshua 6:1', event: 'Conquest of Canaan begins' },
    ],
  },
  {
    id: 'paul1',
    label: "Paul's 1st Journey",
    color: '#3b82f6',
    description: 'Acts 13–14 (~46–48 AD)',
    waypoints: [
      { lat: 36.88, lng: 36.16, name: 'Antioch (Syria)', ref: 'Acts 13:1', event: 'Sent out by church' },
      { lat: 36.78, lng: 34.61, name: 'Seleucia', ref: 'Acts 13:4', event: 'Set sail' },
      { lat: 35.13, lng: 33.94, name: 'Salamis (Cyprus)', ref: 'Acts 13:5', event: 'Preached in synagogues' },
      { lat: 34.92, lng: 33.04, name: 'Paphos (Cyprus)', ref: 'Acts 13:6', event: 'Sorcerer Elymas struck blind' },
      { lat: 36.85, lng: 30.71, name: 'Perga (Pamphylia)', ref: 'Acts 13:13', event: 'John Mark returns home' },
      { lat: 38.29, lng: 31.21, name: 'Pisidian Antioch', ref: 'Acts 13:14', event: 'Synagogue sermon; expelled' },
      { lat: 38.40, lng: 31.88, name: 'Iconium', ref: 'Acts 13:51', event: 'Great multitude believed; plot to stone them' },
      { lat: 37.88, lng: 32.49, name: 'Lystra', ref: 'Acts 14:8', event: 'Lame man healed; Paul stoned' },
      { lat: 37.45, lng: 33.51, name: 'Derbe', ref: 'Acts 14:20', event: 'Many disciples made; turned back' },
    ],
  },
  {
    id: 'paul2',
    label: "Paul's 2nd Journey",
    color: '#8b5cf6',
    description: 'Acts 15:36–18:22 (~49–52 AD)',
    waypoints: [
      { lat: 36.88, lng: 36.16, name: 'Antioch (Syria)', ref: 'Acts 15:36', event: 'Departed with Silas' },
      { lat: 37.88, lng: 32.49, name: 'Lystra', ref: 'Acts 16:1', event: 'Timothy joins the team' },
      { lat: 39.78, lng: 26.98, name: 'Troas', ref: 'Acts 16:8', event: 'Macedonian vision; Luke joins' },
      { lat: 40.84, lng: 24.72, name: 'Neapolis', ref: 'Acts 16:11', event: 'First European landing' },
      { lat: 41.02, lng: 24.30, name: 'Philippi', ref: 'Acts 16:12', event: 'Lydia baptized; Paul & Silas in prison' },
      { lat: 40.52, lng: 22.98, name: 'Thessalonica', ref: 'Acts 17:1', event: 'Preached 3 Sabbaths; uproar' },
      { lat: 40.35, lng: 22.46, name: 'Berea', ref: 'Acts 17:10', event: 'Noble-minded Bereans searched Scriptures' },
      { lat: 37.97, lng: 23.73, name: 'Athens', ref: 'Acts 17:15', event: 'Sermon on Mars Hill (Areopagus)' },
      { lat: 37.94, lng: 22.93, name: 'Corinth', ref: 'Acts 18:1', event: '18 months; met Aquila & Priscilla' },
      { lat: 37.95, lng: 23.75, name: 'Cenchreae', ref: 'Acts 18:18', event: 'Took a vow; sailed for Syria' },
      { lat: 37.94, lng: 27.36, name: 'Ephesus', ref: 'Acts 18:19', event: 'Brief visit; synagogue teaching' },
    ],
  },
  {
    id: 'paul3',
    label: "Paul's 3rd Journey",
    color: '#10b981',
    description: 'Acts 18:23–21:17 (~53–57 AD)',
    waypoints: [
      { lat: 36.88, lng: 36.16, name: 'Antioch (Syria)', ref: 'Acts 18:23', event: 'Departed; strengthened churches' },
      { lat: 37.94, lng: 27.36, name: 'Ephesus', ref: 'Acts 19:1', event: '3 years; Hall of Tyrannus; Demetrius riot' },
      { lat: 40.52, lng: 22.98, name: 'Thessalonica', ref: 'Acts 20:1', event: 'Visit to Macedonia and Greece' },
      { lat: 37.94, lng: 22.93, name: 'Corinth', ref: 'Acts 20:3', event: '3 months; wrote Romans' },
      { lat: 41.02, lng: 24.30, name: 'Philippi', ref: 'Acts 20:6', event: 'Sailed after Passover' },
      { lat: 39.10, lng: 26.55, name: 'Assos', ref: 'Acts 20:13', event: 'Paul walked alone to Assos' },
      { lat: 37.85, lng: 27.26, name: 'Miletus', ref: 'Acts 20:17', event: 'Farewell to Ephesian elders' },
      { lat: 36.36, lng: 29.12, name: 'Patara', ref: 'Acts 21:1', event: 'Changed ships' },
      { lat: 33.90, lng: 35.50, name: 'Tyre', ref: 'Acts 21:3', event: 'Disciples urged Paul not to go to Jerusalem' },
      { lat: 32.82, lng: 34.99, name: 'Caesarea Maritima', ref: 'Acts 21:8', event: 'Philip the evangelist; Agabus prophecy' },
      { lat: 31.78, lng: 35.22, name: 'Jerusalem', ref: 'Acts 21:17', event: 'Arrival; arrested in temple' },
    ],
  },
  {
    id: 'paul_rome',
    label: 'Paul to Rome',
    color: '#ef4444',
    description: 'Acts 27–28 (~60 AD)',
    waypoints: [
      { lat: 32.82, lng: 34.99, name: 'Caesarea Maritima', ref: 'Acts 27:1', event: 'Departed as prisoner' },
      { lat: 36.36, lng: 29.12, name: 'Myra (Lycia)', ref: 'Acts 27:5', event: 'Changed to Alexandrian grain ship' },
      { lat: 35.00, lng: 24.47, name: 'Fair Havens (Crete)', ref: 'Acts 27:8', event: 'Paul warned against sailing' },
      { lat: 35.87, lng: 14.51, name: 'Malta', ref: 'Acts 28:1', event: 'Shipwrecked; Paul bitten by viper' },
      { lat: 40.86, lng: 14.27, name: 'Puteoli', ref: 'Acts 28:13', event: 'Brothers found; stayed 7 days' },
      { lat: 41.90, lng: 12.50, name: 'Rome', ref: 'Acts 28:16', event: 'Paul under house arrest; wrote prison epistles' },
    ],
  },
]

/**
 * Default enabled state — all routes off to avoid visual overload on initial load.
 * Users can enable individually.
 */
export const DEFAULT_ACTIVE_ROUTES = new Set()
