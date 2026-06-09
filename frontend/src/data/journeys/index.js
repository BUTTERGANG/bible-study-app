import exodusRoute from './exodus_route.json'
import paulJourney1 from './paul_journey_1.json'
import paulJourney2 from './paul_journey_2.json'
import paulJourney3 from './paul_journey_3.json'
import paulRome from './paul_rome.json'
import kingdomDavid from './kingdom_david.json'

export const OVERLAY_DEFINITIONS = [
  {
    id: 'exodus_route',
    label: 'Exodus Route',
    color: '#f59e0b',
    type: 'route',
    data: exodusRoute,
  },
  {
    id: 'paul_journey_1',
    label: "Paul's 1st Journey",
    color: '#3b82f6',
    type: 'route',
    data: paulJourney1,
  },
  {
    id: 'paul_journey_2',
    label: "Paul's 2nd Journey",
    color: '#22c55e',
    type: 'route',
    data: paulJourney2,
  },
  {
    id: 'paul_journey_3',
    label: "Paul's 3rd Journey",
    color: '#a855f7',
    type: 'route',
    data: paulJourney3,
  },
  {
    id: 'paul_rome',
    label: 'Paul → Rome',
    color: '#ef4444',
    type: 'route',
    data: paulRome,
  },
  {
    id: 'kingdom_david',
    label: 'Kingdom of David',
    color: '#eab308',
    type: 'polygon',
    data: kingdomDavid,
  },
]

export {
  exodusRoute,
  paulJourney1,
  paulJourney2,
  paulJourney3,
  paulRome,
  kingdomDavid,
}
