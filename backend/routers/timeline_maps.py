"""Timeline & Maps — chronological events and geographical places from the Bible.

GET /api/timeline          — all events (optional ?category=&book_ref=)
GET /api/timeline/by-verse — events related to current passage (?book=&chapter=&verse=)
GET /api/maps/places       — all biblical places (optional ?type=)
GET /api/maps/routes       — all journey routes
GET /api/maps/by-verse     — places/routes related to current passage
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import BiblicalPlace, JourneyRoute, TimelineEvent

router = APIRouter(prefix="/api", tags=["timeline-maps"])


# ── Seed data ────────────────────────────────────────────────────────────────

_TIMELINE_SEED = [
    # ── Creation & Primeval History ──────────────────────────────────────────
    ("Creation", "Beginning of time", -99999, "God creates the heavens, earth, light, seas, land, plants, animals, and humanity in six days.", "Genesis 1:1-2:3", "creation"),
    ("The Fall", "~4000 BC (traditional)", -4000, "Adam and Eve disobey God in the Garden of Eden, introducing sin and death into the world.", "Genesis 3:1-24", "creation"),
    ("Cain and Abel", "~3900 BC (traditional)", -3900, "Cain murders his brother Abel — the first homicide recorded in Scripture.", "Genesis 4:1-16", "creation"),
    ("The Great Flood", "~2348 BC (traditional)", -2348, "God sends a worldwide flood to judge sin; Noah, his family, and animals are preserved on the ark.", "Genesis 6:1-9:17", "creation"),
    ("Tower of Babel", "~2200 BC", -2200, "Humanity attempts to build a tower to the heavens; God confuses their language and scatters them.", "Genesis 11:1-9", "creation"),

    # ── Patriarchs ───────────────────────────────────────────────────────────
    ("Call of Abraham", "~2091 BC", -2091, "God calls Abram to leave Ur of the Chaldeans and travel to the Promised Land, making him the father of many nations.", "Genesis 12:1-9", "patriarchs"),
    ("Abrahamic Covenant", "~2081 BC", -2081, "God establishes His covenant with Abraham, promising land, descendants, and blessing for all nations.", "Genesis 15:1-21", "patriarchs"),
    ("Destruction of Sodom", "~2067 BC", -2067, "God destroys Sodom and Gomorrah with fire and sulfur for their great wickedness; Lot and his daughters are spared.", "Genesis 19:1-29", "patriarchs"),
    ("Birth of Isaac", "~2066 BC", -2066, "Sarah gives birth to Isaac, the son of promise, when Abraham is 100 years old.", "Genesis 21:1-7", "patriarchs"),
    ("Binding of Isaac", "~2050 BC", -2050, "God tests Abraham by commanding him to sacrifice Isaac on Mount Moriah; an angel stops him and provides a ram.", "Genesis 22:1-19", "patriarchs"),
    ("Jacob Wrestles with God", "~1906 BC", -1906, "Jacob wrestles with a divine being at Penuel and receives the name Israel ('one who strives with God').", "Genesis 32:22-32", "patriarchs"),
    ("Joseph Sold into Egypt", "~1898 BC", -1898, "Joseph's brothers sell him to Midianite traders out of jealousy over his coat of many colors and his dreams.", "Genesis 37:12-36", "patriarchs"),
    ("Joseph Rules in Egypt", "~1885 BC", -1885, "Pharaoh elevates Joseph to second-in-command over all Egypt after interpreting his dreams about seven years of plenty and famine.", "Genesis 41:37-57", "patriarchs"),
    ("Jacob's Family Moves to Egypt", "~1876 BC", -1876, "Jacob and seventy family members relocate to Goshen, Egypt, during the famine — the start of Israel's sojourn in Egypt.", "Genesis 46:1-7", "patriarchs"),

    # ── Exodus ───────────────────────────────────────────────────────────────
    ("Birth of Moses", "~1526 BC", -1526, "Moses is born to a Levite family; his mother hides him in a basket on the Nile; Pharaoh's daughter adopts him.", "Exodus 2:1-10", "exodus"),
    ("The Burning Bush", "~1446 BC", -1446, "God appears to Moses in a burning bush at Mount Horeb and commissions him to deliver Israel from Egypt.", "Exodus 3:1-4:17", "exodus"),
    ("The Ten Plagues", "~1446 BC", -1446, "God sends ten plagues upon Egypt to compel Pharaoh to release Israel, culminating in the death of the firstborn.", "Exodus 7:14-12:30", "exodus"),
    ("The Exodus from Egypt", "~1446 BC", -1446, "Israel departs Egypt after 430 years of sojourn; approximately 600,000 men plus women and children leave.", "Exodus 12:31-42", "exodus"),
    ("Crossing the Red Sea", "~1446 BC", -1446, "God parts the Red Sea, Israel crosses on dry ground, and Pharaoh's pursuing army is drowned.", "Exodus 14:1-31", "exodus"),
    ("Ten Commandments Given", "~1446 BC", -1445, "God gives the Ten Commandments and the Law to Moses at Mount Sinai; the Mosaic Covenant is established.", "Exodus 20:1-17", "exodus"),
    ("The Golden Calf", "~1445 BC", -1445, "While Moses is on the mountain, Israel worships a golden calf; Moses intercedes and God relents from destroying the nation.", "Exodus 32:1-35", "exodus"),
    ("The Tabernacle Completed", "~1445 BC", -1445, "The portable tabernacle is constructed according to God's design; the glory of God fills it.", "Exodus 40:1-38", "exodus"),

    # ── Wilderness & Conquest ────────────────────────────────────────────────
    ("The Twelve Spies", "~1444 BC", -1444, "Twelve spies explore Canaan; ten give a fearful report and the people rebel; Israel is condemned to forty years in the wilderness.", "Numbers 13:1-14:45", "conquest"),
    ("Bronze Serpent", "~1406 BC", -1406, "God sends fiery serpents to judge Israel's complaining; Moses lifts a bronze serpent on a pole — those who look at it live.", "Numbers 21:4-9", "conquest"),
    ("Death of Moses", "~1406 BC", -1406, "Moses views the Promised Land from Mount Nebo and dies at age 120; Joshua succeeds him as leader.", "Deuteronomy 34:1-12", "conquest"),
    ("Crossing the Jordan", "~1406 BC", -1406, "Israel crosses the Jordan River on dry ground as it stops flowing; they erect twelve stones as a memorial.", "Joshua 3:1-4:24", "conquest"),
    ("Fall of Jericho", "~1406 BC", -1406, "Israel marches around Jericho for seven days; the walls collapse and the city is taken — except for Rahab and her family.", "Joshua 6:1-27", "conquest"),
    ("Sun Stands Still", "~1405 BC", -1405, "During the battle of Gibeon, God causes the sun and moon to stand still to give Israel more daylight to defeat their enemies.", "Joshua 10:12-14", "conquest"),
    ("Land Divided Among Tribes", "~1400 BC", -1400, "Joshua divides the Promised Land among the twelve tribes of Israel by lot.", "Joshua 13-21", "conquest"),

    # ── Judges ───────────────────────────────────────────────────────────────
    ("Period of the Judges Begins", "~1380 BC", -1380, "After Joshua's death, Israel repeatedly cycles through sin, oppression, crying to God, and deliverance through judges.", "Judges 2:11-23", "judges"),
    ("Gideon's 300", "~1169 BC", -1169, "Gideon defeats the Midianite army of 135,000 with only 300 men armed with trumpets and torches — demonstrating God's power.", "Judges 7:1-25", "judges"),
    ("Samson and Delilah", "~1070 BC", -1070, "Delilah discovers the secret of Samson's strength; the Philistines shave his head, blind him, and imprison him.", "Judges 16:1-31", "judges"),
    ("Story of Ruth", "~1100 BC", -1100, "Ruth, a Moabite widow, remains loyal to her mother-in-law Naomi and marries Boaz — an ancestor of King David.", "Ruth 1:1-4:22", "judges"),

    # ── United Monarchy ──────────────────────────────────────────────────────
    ("Samuel Born", "~1105 BC", -1105, "Hannah's prayer for a son is answered; Samuel is born and dedicated to the Lord's service at the tabernacle.", "1 Samuel 1:1-28", "monarchy"),
    ("Saul Becomes King", "~1050 BC", -1050, "Israel demands a king; God gives them Saul of Benjamin — the first king of Israel.", "1 Samuel 10:17-27", "monarchy"),
    ("David Kills Goliath", "~1025 BC", -1025, "The young shepherd David defeats the Philistine giant Goliath with a sling and a stone, in the name of the LORD.", "1 Samuel 17:1-58", "monarchy"),
    ("David Becomes King", "~1010 BC", -1010, "David is anointed king over all Israel after the death of Saul; he captures Jerusalem and makes it his capital.", "2 Samuel 5:1-12", "monarchy"),
    ("Davidic Covenant", "~1000 BC", -1000, "God promises David that his throne will be established forever — an eternal dynasty fulfilled in Jesus Christ.", "2 Samuel 7:1-17", "monarchy"),
    ("David and Bathsheba", "~993 BC", -993, "David commits adultery with Bathsheba and arranges the death of her husband Uriah; Nathan the prophet confronts him.", "2 Samuel 11:1-12:15", "monarchy"),
    ("Solomon's Temple Built", "~966-959 BC", -966, "Solomon constructs the magnificent first Temple in Jerusalem; the glory of God fills the Temple at its dedication.", "1 Kings 6:1-8:66", "monarchy"),
    ("Solomon's Wisdom", "~970 BC", -970, "God appears to Solomon and offers him anything; he requests wisdom, and God grants it along with riches and honor.", "1 Kings 3:1-28", "monarchy"),
    ("Kingdom Divides", "~931 BC", -931, "After Solomon's death, the kingdom splits: the Northern Kingdom (Israel, 10 tribes) under Jeroboam, Southern (Judah) under Rehoboam.", "1 Kings 12:1-24", "monarchy"),

    # ── Prophets & Exile ─────────────────────────────────────────────────────
    ("Elijah and the Prophets of Baal", "~874 BC", -874, "Elijah challenges and defeats 450 prophets of Baal on Mount Carmel; fire from heaven consumes the sacrifice and water.", "1 Kings 18:1-46", "exile"),
    ("Elijah Taken to Heaven", "~848 BC", -848, "Elijah is taken to heaven in a chariot of fire and whirlwind; Elisha receives a double portion of his spirit.", "2 Kings 2:1-18", "exile"),
    ("Fall of the Northern Kingdom", "722 BC", -722, "Assyria under Sargon II conquers Samaria, exiles the northern tribes, and resettles the land with foreigners.", "2 Kings 17:1-41", "exile"),
    ("Hezekiah and Sennacherib", "701 BC", -701, "Assyria besieges Jerusalem; Isaiah prophesies deliverance; the angel of the LORD strikes 185,000 Assyrian soldiers.", "2 Kings 18:13-19:37", "exile"),
    ("Josiah's Reforms", "~621 BC", -621, "King Josiah rediscovers the Book of the Law, leads a national revival, and destroys Baal altars and high places throughout Judah.", "2 Kings 22:1-23:30", "exile"),
    ("First Deportation to Babylon", "605 BC", -605, "Nebuchadnezzar besieges Jerusalem and takes Daniel and other nobles to Babylon — the beginning of the Babylonian exile.", "2 Kings 24:1-7", "exile"),
    ("Destruction of Jerusalem", "586 BC", -586, "Nebuchadnezzar destroys Solomon's Temple and burns Jerusalem; most of the remaining population is exiled to Babylon.", "2 Kings 25:1-21", "exile"),

    # ── Exile & Restoration ──────────────────────────────────────────────────
    ("Daniel in the Lion's Den", "~539 BC", -539, "Daniel is thrown into the lion's den for praying to God; he is miraculously preserved and his accusers are destroyed.", "Daniel 6:1-28", "restoration"),
    ("Cyrus Decree — Return from Exile", "538 BC", -538, "Cyrus the Great of Persia decrees that Jewish exiles may return to Judah and rebuild the Temple — fulfilling Isaiah's prophecy.", "Ezra 1:1-11", "restoration"),
    ("Second Temple Completed", "516 BC", -516, "The rebuilt Temple in Jerusalem is completed and dedicated under Zerubbabel's leadership, 70 years after the first Temple's destruction.", "Ezra 6:13-22", "restoration"),
    ("Esther Saves Her People", "~479 BC", -479, "Queen Esther risks her life to expose Haman's plot to exterminate the Jews; Purim is established to commemorate God's deliverance.", "Esther 4:1-9:32", "restoration"),
    ("Ezra Returns to Jerusalem", "458 BC", -458, "The priest-scribe Ezra leads a second group of exiles back to Jerusalem and begins religious reforms.", "Ezra 7:1-10", "restoration"),
    ("Nehemiah Rebuilds the Walls", "445 BC", -445, "Nehemiah leads the rebuilding of Jerusalem's walls in 52 days despite fierce opposition; the city is repopulated.", "Nehemiah 1:1-7:73", "restoration"),

    # ── Gospels ──────────────────────────────────────────────────────────────
    ("Birth of John the Baptist", "~6 BC", -6, "The angel Gabriel announces to Zechariah that his elderly wife Elizabeth will bear a son, John, who will prepare the way for the Lord.", "Luke 1:5-25, 57-80", "gospels"),
    ("Birth of Jesus", "~5-4 BC", -5, "Jesus is born in Bethlehem of Judea to the Virgin Mary; angels announce his birth to shepherds; Magi come from the East.", "Matthew 1:18-2:12, Luke 2:1-20", "gospels"),
    ("Flight to Egypt", "~4 BC", -4, "Joseph takes Mary and Jesus to Egypt to escape Herod's massacre of infant boys; they return after Herod's death.", "Matthew 2:13-23", "gospels"),
    ("Jesus at the Temple Age 12", "~9 AD", 9, "Jesus stays behind in Jerusalem and is found by his parents discussing Scripture with the teachers in the Temple.", "Luke 2:41-52", "gospels"),
    ("Baptism of Jesus", "~27 AD", 27, "John baptizes Jesus in the Jordan River; the Holy Spirit descends like a dove and the Father's voice declares: 'This is my beloved Son.'", "Matthew 3:13-17, Mark 1:9-11", "gospels"),
    ("Temptation of Jesus", "~27 AD", 27, "Jesus fasts forty days in the Judean wilderness and is tempted three times by Satan; he responds with Scripture.", "Matthew 4:1-11, Luke 4:1-13", "gospels"),
    ("Sermon on the Mount", "~28 AD", 28, "Jesus preaches the Beatitudes, teaches on the Law, prayer, fasting, and the Kingdom of God on a hillside in Galilee.", "Matthew 5:1-7:29", "gospels"),
    ("Feeding the 5,000", "~29 AD", 29, "Jesus miraculously feeds over 5,000 people with five loaves and two fish, with twelve baskets of fragments left over.", "John 6:1-15, Matthew 14:13-21", "gospels"),
    ("Transfiguration", "~29 AD", 29, "Jesus is transfigured before Peter, James, and John on a high mountain; Moses and Elijah appear; God's voice affirms Jesus as his Son.", "Matthew 17:1-9, Mark 9:2-8", "gospels"),
    ("Triumphal Entry", "~30 AD", 30, "Jesus enters Jerusalem on a donkey to the crowds' 'Hosanna!' — fulfilling Zechariah 9:9 and marking the beginning of Passion Week.", "Matthew 21:1-11, John 12:12-19", "gospels"),
    ("Last Supper", "~30 AD", 30, "Jesus shares a final Passover meal with his disciples, instituting the Lord's Supper with bread and cup as symbols of his body and blood.", "Matthew 26:17-30, 1 Corinthians 11:23-26", "gospels"),
    ("Gethsemane", "~30 AD", 30, "Jesus prays in agony in the Garden of Gethsemane and is betrayed by Judas with a kiss; he is arrested by the Jewish authorities.", "Matthew 26:36-56, Luke 22:39-53", "gospels"),
    ("Crucifixion", "~30 AD", 30, "Jesus is crucified at Golgotha between two criminals; darkness covers the land; the Temple veil is torn; he dies and is buried.", "Matthew 27:32-66, John 19:17-42", "gospels"),
    ("Resurrection", "~30 AD", 30, "On the first day of the week women find the empty tomb; Jesus appears to Mary Magdalene, the disciples, and over 500 people.", "Matthew 28:1-20, 1 Corinthians 15:3-8", "gospels"),
    ("Ascension", "~30 AD", 30, "Jesus ascends bodily into heaven from the Mount of Olives forty days after the resurrection; angels promise his return.", "Acts 1:9-11, Luke 24:50-53", "gospels"),

    # ── Acts & Early Church ───────────────────────────────────────────────────
    ("Pentecost", "~30 AD", 30, "The Holy Spirit descends on 120 disciples in Jerusalem; Peter preaches and 3,000 are baptized — the birth of the church.", "Acts 2:1-41", "acts"),
    ("Stoning of Stephen", "~35 AD", 35, "Stephen, the first Christian martyr, is stoned after his sermon before the Sanhedrin; Saul of Tarsus watches and approves.", "Acts 7:54-8:1", "acts"),
    ("Conversion of Saul", "~35 AD", 35, "Saul is struck by a blinding light on the road to Damascus; he hears Jesus's voice and is converted, becoming the Apostle Paul.", "Acts 9:1-19", "acts"),
    ("Peter and Cornelius", "~37 AD", 37, "The Holy Spirit falls on the Gentile household of Cornelius while Peter is preaching — signaling that salvation is for all nations.", "Acts 10:1-48", "acts"),
    ("Council of Jerusalem", "~49 AD", 49, "The first church council determines that Gentile believers are not required to be circumcised or keep the full Mosaic Law.", "Acts 15:1-35", "acts"),
    ("Paul's First Missionary Journey", "~47-48 AD", 47, "Paul and Barnabas travel through Cyprus and Asia Minor (modern Turkey), planting churches in Antioch, Iconium, Lystra, and Derbe.", "Acts 13:1-14:28", "acts"),
    ("Paul's Second Missionary Journey", "~49-52 AD", 49, "Paul and Silas travel through Asia Minor and into Macedonia and Greece, planting churches at Philippi, Thessalonica, Berea, Athens, and Corinth.", "Acts 15:36-18:22", "acts"),
    ("Paul's Third Missionary Journey", "~53-57 AD", 53, "Paul spends three years in Ephesus, then travels through Macedonia and Greece, returning to Jerusalem with a collection for poor believers.", "Acts 18:23-21:17", "acts"),
    ("Paul's Arrest in Jerusalem", "57 AD", 57, "Paul is seized in the Temple by a Jewish mob; Roman soldiers arrest him; he begins two years of imprisonment in Caesarea.", "Acts 21:27-36", "acts"),
    ("Paul in Rome", "~60-62 AD", 60, "Paul arrives in Rome under house arrest and spends two years preaching the Kingdom of God to all who visit him.", "Acts 28:16-31", "acts"),

    # ── Revelation & End ─────────────────────────────────────────────────────
    ("Destruction of Jerusalem", "70 AD", 70, "Roman general Titus destroys Jerusalem and the Second Temple; fulfilling Jesus's prophecy in Matthew 24. About 1 million Jews perish.", "Matthew 24:1-2, Luke 21:20-24", "epistles"),
    ("John's Vision on Patmos", "~95 AD", 95, "The apostle John receives the Revelation while exiled on the island of Patmos, addressed to seven churches of Asia Minor.", "Revelation 1:1-20", "revelation"),
]

_PLACES_SEED = [
    # name, lat, lng, description, verse_refs, type
    ("Jerusalem", 31.7683, 35.2137, "The holy city of Israel — capital of David's kingdom and site of the Temple.", "2 Samuel 5:6-9, Psalm 122:1-9", "city"),
    ("Bethlehem", 31.7054, 35.2024, "The birthplace of King David and Jesus Christ, 10 km south of Jerusalem.", "Ruth 1:1, Micah 5:2, Luke 2:1-7", "city"),
    ("Nazareth", 32.7021, 35.2978, "The town in Galilee where Jesus grew up after the family returned from Egypt.", "Luke 2:39-40, Luke 4:16-30", "city"),
    ("Capernaum", 32.8814, 35.5748, "Jesus's base of ministry in Galilee, on the north shore of the Sea of Galilee.", "Matthew 4:13, Mark 1:21", "city"),
    ("Jericho", 31.8667, 35.4444, "The first city conquered by Israel in Canaan; the oldest continuously inhabited city in the world.", "Joshua 6:1-27, Luke 19:1-10", "city"),
    ("Hebron", 31.5326, 35.0998, "Abraham's burial site; David was first crowned king here before Jerusalem.", "Genesis 23:2, 2 Samuel 2:1-4", "city"),
    ("Beersheba", 31.2518, 34.7913, "The southernmost city of ancient Israel — 'from Dan to Beersheba' marked the full extent of the land.", "Genesis 21:31, Judges 20:1", "city"),
    ("Dan", 33.2484, 35.6517, "The northernmost city of ancient Israel; site of Jeroboam's golden calf and a tribe's territory.", "Judges 18:29, 1 Kings 12:28-30", "city"),
    ("Samaria", 32.2742, 35.2026, "Capital of the Northern Kingdom of Israel, built by King Omri.", "1 Kings 16:24, 2 Kings 17:5-6", "city"),
    ("Shechem", 32.2097, 35.2729, "First city Abraham visited in Canaan; site of Jacob's well and Joshua's covenant renewal.", "Genesis 12:6, Joshua 24:1-28", "city"),
    ("Bethel", 31.9267, 35.2228, "Where Jacob dreamed of angels on a stairway to heaven; later a site of idolatrous worship.", "Genesis 28:10-22, 1 Kings 12:28-29", "city"),
    ("Shiloh", 32.0581, 35.2903, "Location of the Tabernacle and the Ark of the Covenant during the period of the Judges.", "Joshua 18:1, 1 Samuel 1:3", "city"),
    ("Babylon", 32.5355, 44.4275, "Capital of the Neo-Babylonian Empire; site of Israel's 70-year exile and Daniel's ministry.", "2 Kings 25:1-21, Daniel 1:1", "city"),
    ("Nineveh", 36.3591, 43.1589, "Capital of ancient Assyria; Jonah's mission field; destroyed in 612 BC as Nahum prophesied.", "Jonah 3:1-10, Nahum 1:1", "city"),
    ("Ur", 30.9625, 46.1034, "Abraham's hometown in ancient Mesopotamia (modern southern Iraq).", "Genesis 11:31", "city"),
    ("Antioch (Syria)", 36.2021, 36.1604, "The first place believers were called 'Christians'; base for Paul's missionary journeys.", "Acts 11:26, Acts 13:1-3", "city"),
    ("Rome", 41.9028, 12.4964, "Capital of the Roman Empire; Paul's destination as a prisoner; site of Peter and Paul's martyrdom.", "Romans 1:7, Acts 28:16-31", "city"),
    ("Corinth", 37.9334, 22.9214, "A major commercial city of Greece; Paul planted a church and wrote two letters to it.", "Acts 18:1-18, 1 Corinthians 1:2", "city"),
    ("Ephesus", 37.9396, 27.3408, "A major city of Asia Minor (Turkey); Paul spent three years here; one of the seven churches in Revelation.", "Acts 19:1-41, Revelation 2:1-7", "city"),
    ("Athens", 37.9838, 23.7275, "The philosophical capital of Greece; Paul preached on the Areopagus about the 'unknown god'.", "Acts 17:15-34", "city"),
    ("Philippi", 41.0138, 24.2918, "First European city to have a Christian church, founded by Paul and Silas; Lydia was converted here.", "Acts 16:12-40, Philippians 1:1", "city"),
    ("Thessalonica", 40.6401, 22.9444, "A major Macedonian city where Paul planted a church during his second journey.", "Acts 17:1-9, 1 Thessalonians 1:1", "city"),
    ("Alexandria", 31.2001, 29.9187, "Egyptian port city; home of the Septuagint translation and Apollos the eloquent preacher.", "Acts 18:24", "city"),
    ("Caesarea Maritima", 32.5036, 34.8928, "Roman administrative capital of Judea; Philip the evangelist lived here; Paul was imprisoned here.", "Acts 8:40, Acts 23:23-35", "city"),
    ("Joppa", 32.0564, 34.7538, "Mediterranean port city where Jonah boarded a ship; Peter raised Dorcas from the dead here.", "Jonah 1:3, Acts 9:36-43", "city"),

    # Mountains
    ("Mount Sinai (Horeb)", 28.5397, 33.9750, "The mountain where God gave the Law to Moses and Elijah heard the still small voice.", "Exodus 19:1-20:21, 1 Kings 19:8-18", "mountain"),
    ("Mount Zion", 31.7713, 35.2270, "The hill of Jerusalem associated with the Temple and the City of David; used spiritually of God's dwelling.", "2 Samuel 5:7, Psalm 48:1-3", "mountain"),
    ("Mount Carmel", 32.7396, 35.0628, "Site of Elijah's contest with the prophets of Baal; a prominent ridge along the Mediterranean coast.", "1 Kings 18:19-46", "mountain"),
    ("Mount Hermon", 33.3333, 35.7667, "The highest mountain in the region (2,814m); possibly the site of the Transfiguration.", "Psalm 133:3, Matthew 17:1", "mountain"),
    ("Mount Tabor", 32.6858, 35.3895, "Site associated with the Transfiguration of Jesus; scene of Deborah and Barak's victory.", "Judges 4:6-16, Mark 9:2", "mountain"),
    ("Mount Nebo", 31.7667, 35.7333, "The mountain in Moab from which Moses viewed the Promised Land before his death.", "Deuteronomy 34:1-8", "mountain"),
    ("Mount of Olives", 31.7752, 35.2414, "East of Jerusalem; site of Gethsemane, the Ascension, and Jesus's end-times discourse.", "Zechariah 14:4, Luke 22:39, Acts 1:12", "mountain"),

    # Bodies of Water
    ("Sea of Galilee", 32.8228, 35.5862, "The freshwater lake where Jesus called his first disciples and performed many miracles.", "Mark 1:16-20, Matthew 8:23-27", "sea"),
    ("Jordan River", 31.8328, 35.5539, "The river where Israel crossed into Canaan, Jesus was baptized, and Naaman was healed.", "Joshua 3:14-17, Matthew 3:13-17, 2 Kings 5:14", "river"),
    ("Dead Sea", 31.5590, 35.4732, "The lowest point on earth; receives the Jordan's water but has no outlet; mentioned as eastern border.", "Numbers 34:3, Ezekiel 47:1-12", "sea"),
    ("Red Sea", 28.0, 33.0, "The body of water parted for Israel's escape from Egypt; the Exodus crossing point.", "Exodus 14:21-31, Hebrews 11:29", "sea"),
    ("Mediterranean Sea", 33.0, 22.0, "The 'Great Sea' of biblical geography; Paul sailed it repeatedly on his missionary journeys.", "Numbers 34:6, Acts 27:1-44", "sea"),

    # Regions
    ("Galilee", 32.8, 35.5, "Northern region of Israel; Jesus's primary area of ministry.", "Isaiah 9:1-2, Matthew 4:12-17", "region"),
    ("Judea", 31.5, 35.2, "The southern region of ancient Israel including Jerusalem and Bethlehem.", "Matthew 2:1, John 7:1", "region"),
    ("Samaria", 32.2, 35.2, "The region between Galilee and Judea inhabited by the Samaritans after the Assyrian exile.", "John 4:4-42, Acts 1:8", "region"),
    ("Wilderness of Judea", 31.6, 35.4, "Arid desert region east of Jerusalem; Jesus's forty-day temptation occurred here.", "Matthew 3:1, Luke 4:1", "wilderness"),
    ("Land of Goshen", 30.6, 32.0, "The fertile region in Egypt where Israel lived during the 400-year sojourn.", "Genesis 45:10, Exodus 8:22", "region"),
    ("Philistia", 31.6, 34.6, "The coastal plain of Canaan occupied by the Philistines, Israel's frequent adversaries.", "Judges 13:1, 1 Samuel 4:1", "region"),
    ("Garden of Gethsemane", 31.7792, 35.2397, "The garden at the foot of the Mount of Olives where Jesus prayed before his arrest.", "Matthew 26:36-56, Luke 22:39-53", "wilderness"),
    ("Pool of Bethesda", 31.7817, 35.2368, "The pool in Jerusalem where Jesus healed a paralyzed man who had been ill for 38 years.", "John 5:2-15", "city"),
    ("Golgotha", 31.7784, 35.2294, "The 'Place of the Skull' where Jesus was crucified, just outside Jerusalem's walls.", "Matthew 27:33, John 19:17", "mountain"),
]

_ROUTES_SEED = [
    {
        "route_name": "The Exodus Route",
        "description": "Israel's journey from Egypt through the wilderness to Canaan (~1446 BC)",
        "color": "#f59e0b",
        "verse_refs": "Exodus 12:37, Numbers 33:1-49",
        "coordinates": [
            [30.62, 32.27],   # Goshen / Rameses
            [30.55, 32.55],   # Succoth
            [30.72, 32.60],   # Etham
            [29.90, 32.60],   # Pi-hahiroth / Red Sea crossing
            [28.70, 32.90],   # Marah
            [28.53, 33.97],   # Mount Sinai (Horeb)
            [29.60, 34.80],   # Kadesh-barnea
            [30.35, 35.08],   # Punon / Oboth
            [31.50, 35.55],   # Plains of Moab
        ],
    },
    {
        "route_name": "Abraham's Journey from Ur",
        "description": "Abraham's migration from Ur to Canaan (~2091 BC)",
        "color": "#8b5cf6",
        "verse_refs": "Genesis 11:31-12:9",
        "coordinates": [
            [30.96, 46.10],   # Ur of the Chaldeans
            [36.82, 39.10],   # Haran
            [36.20, 36.16],   # Into Canaan (northern entry)
            [32.21, 35.27],   # Shechem
            [31.93, 35.22],   # Bethel
            [31.25, 34.79],   # Negev / Beersheba area
        ],
    },
    {
        "route_name": "Paul's First Missionary Journey",
        "description": "Paul and Barnabas travel through Cyprus and Asia Minor (~47-48 AD)",
        "color": "#ef4444",
        "verse_refs": "Acts 13:1-14:28",
        "coordinates": [
            [36.20, 36.16],   # Antioch (Syria)
            [35.17, 33.36],   # Salamis, Cyprus
            [34.67, 32.99],   # Paphos, Cyprus
            [36.83, 30.70],   # Perga
            [38.29, 31.41],   # Pisidian Antioch
            [37.87, 31.99],   # Iconium
            [37.58, 32.14],   # Lystra
            [37.37, 32.48],   # Derbe
            [37.58, 32.14],   # (return) Lystra
            [37.87, 31.99],   # (return) Iconium
            [36.83, 30.70],   # (return) Perga
            [36.20, 36.16],   # Back to Antioch
        ],
    },
    {
        "route_name": "Paul's Second Missionary Journey",
        "description": "Paul and Silas travel to Macedonia and Greece (~49-52 AD)",
        "color": "#10b981",
        "verse_refs": "Acts 15:36-18:22",
        "coordinates": [
            [36.20, 36.16],   # Antioch (Syria)
            [37.58, 32.14],   # Lystra (Timothy joins)
            [39.74, 27.48],   # Troas (Macedonia vision)
            [40.84, 24.73],   # Neapolis
            [41.01, 24.29],   # Philippi
            [40.64, 22.94],   # Thessalonica
            [41.04, 22.08],   # Berea
            [37.98, 23.73],   # Athens
            [37.93, 22.92],   # Corinth (18 months)
            [37.94, 27.34],   # Ephesus (brief visit)
            [31.90, 34.85],   # Caesarea Maritima
            [36.20, 36.16],   # Back to Antioch
        ],
    },
    {
        "route_name": "Paul's Third Missionary Journey",
        "description": "Paul's extended ministry in Ephesus and return to Jerusalem (~53-57 AD)",
        "color": "#0ea5e9",
        "verse_refs": "Acts 18:23-21:17",
        "coordinates": [
            [36.20, 36.16],   # Antioch (Syria)
            [37.94, 27.34],   # Ephesus (3 years)
            [41.01, 24.29],   # Philippi (through Macedonia)
            [40.64, 22.94],   # Thessalonica
            [41.04, 22.08],   # Berea
            [37.93, 22.92],   # Corinth
            [41.01, 24.29],   # (return) Philippi
            [39.12, 26.54],   # Mitylene
            [38.46, 26.13],   # Miletus (farewell to Ephesian elders)
            [32.50, 34.89],   # Caesarea Maritima
            [31.77, 35.21],   # Jerusalem
        ],
    },
    {
        "route_name": "Jesus's Journey to the Cross",
        "description": "Key locations in Jesus's final week in Jerusalem (~30 AD)",
        "color": "#dc2626",
        "verse_refs": "Matthew 21:1-27:66",
        "coordinates": [
            [31.85, 35.26],   # Bethany
            [31.78, 35.24],   # Mount of Olives / Bethphage
            [31.78, 35.23],   # Gethsemane
            [31.78, 35.23],   # Temple Mount (Triumphal Entry)
            [31.78, 35.23],   # Upper Room area (Last Supper)
            [31.78, 35.23],   # Gethsemane (prayer/arrest)
            [31.78, 35.23],   # High Priest's house
            [31.78, 35.23],   # Pilate's Praetorium
            [31.78, 35.23],   # Golgotha
            [31.78, 35.23],   # Garden Tomb
        ],
    },
    {
        "route_name": "Flight to Egypt and Return",
        "description": "Mary, Joseph, and Jesus flee to Egypt and return to Nazareth (~4 BC)",
        "color": "#f97316",
        "verse_refs": "Matthew 2:13-23",
        "coordinates": [
            [31.71, 35.20],   # Bethlehem
            [30.06, 31.24],   # Egypt (Cairo / Heliopolis area)
            [32.70, 35.30],   # Nazareth
        ],
    },
    {
        "route_name": "Israel's Conquest of Canaan",
        "description": "Joshua's campaign to take the Promised Land (~1406-1400 BC)",
        "color": "#84cc16",
        "verse_refs": "Joshua 3-12",
        "coordinates": [
            [31.50, 35.55],   # Plains of Moab
            [31.87, 35.44],   # Jericho (western crossing)
            [31.86, 35.22],   # Gilgal (camp)
            [31.87, 35.44],   # Jericho (destroyed)
            [31.92, 35.27],   # Ai / Bethel
            [31.93, 35.22],   # Bethel area
            [31.75, 34.97],   # Libnah (southern campaign)
            [31.53, 35.10],   # Hebron
            [31.43, 35.09],   # Debir
            [32.21, 35.27],   # Shechem (covenant)
        ],
    },
]


async def seed_timeline_data(db: AsyncSession) -> int:
    """Insert timeline and map seed data if the tables are empty. Returns count inserted."""
    from sqlalchemy import func, text

    result = await db.execute(select(func.count()).select_from(TimelineEvent))
    count = result.scalar_one()
    if count > 0:
        return 0

    inserted = 0
    for name, date_approx, date_sort, description, verse_refs, category in _TIMELINE_SEED:
        db.add(TimelineEvent(
            event_name=name,
            date_approx=date_approx,
            date_sort=date_sort,
            description=description,
            verse_refs=verse_refs,
            category=category,
        ))
        inserted += 1

    result = await db.execute(select(func.count()).select_from(BiblicalPlace))
    place_count = result.scalar_one()
    if place_count == 0:
        for name, lat, lng, description, verse_refs, place_type in _PLACES_SEED:
            db.add(BiblicalPlace(
                place_name=name,
                lat=lat,
                lng=lng,
                description=description,
                verse_refs=verse_refs,
                place_type=place_type,
            ))

    result = await db.execute(select(func.count()).select_from(JourneyRoute))
    route_count = result.scalar_one()
    if route_count == 0:
        for r in _ROUTES_SEED:
            db.add(JourneyRoute(
                route_name=r["route_name"],
                description=r["description"],
                coordinates=json.dumps(r["coordinates"]),
                verse_refs=r["verse_refs"],
                color=r["color"],
            ))

    await db.commit()
    return inserted


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/timeline")
async def get_timeline(
    category: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return all timeline events, optionally filtered by category."""
    q = select(TimelineEvent).order_by(TimelineEvent.date_sort)
    if category:
        q = q.where(TimelineEvent.category == category)
    result = await db.execute(q)
    events = result.scalars().all()
    return {
        "events": [
            {
                "id": e.id,
                "event_name": e.event_name,
                "date_approx": e.date_approx,
                "date_sort": e.date_sort,
                "description": e.description,
                "verse_refs": e.verse_refs,
                "category": e.category,
            }
            for e in events
        ],
        "count": len(events),
    }


@router.get("/timeline/by-verse")
async def get_timeline_by_verse(
    book: str = Query(...),
    chapter: Optional[int] = Query(default=None),
    verse: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return timeline events whose verse_refs mention the given book (and optionally chapter)."""
    q = select(TimelineEvent).where(
        or_(
            TimelineEvent.verse_refs.ilike(f"%{book}%"),
            TimelineEvent.description.ilike(f"%{book}%"),
        )
    ).order_by(TimelineEvent.date_sort)
    result = await db.execute(q)
    events = result.scalars().all()
    return {
        "events": [
            {
                "id": e.id,
                "event_name": e.event_name,
                "date_approx": e.date_approx,
                "date_sort": e.date_sort,
                "description": e.description,
                "verse_refs": e.verse_refs,
                "category": e.category,
            }
            for e in events
        ],
        "count": len(events),
    }


@router.get("/maps/places")
async def get_places(
    place_type: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return all biblical places, optionally filtered by type."""
    q = select(BiblicalPlace).order_by(BiblicalPlace.place_name)
    if place_type:
        q = q.where(BiblicalPlace.place_type == place_type)
    result = await db.execute(q)
    places = result.scalars().all()
    return {
        "places": [
            {
                "id": p.id,
                "place_name": p.place_name,
                "lat": p.lat,
                "lng": p.lng,
                "description": p.description,
                "verse_refs": p.verse_refs,
                "place_type": p.place_type,
            }
            for p in places
        ],
        "count": len(places),
    }


@router.get("/maps/routes")
async def get_routes(db: AsyncSession = Depends(get_db)):
    """Return all journey routes with decoded coordinates."""
    result = await db.execute(select(JourneyRoute).order_by(JourneyRoute.route_name))
    routes = result.scalars().all()
    return {
        "routes": [
            {
                "id": r.id,
                "route_name": r.route_name,
                "description": r.description,
                "coordinates": json.loads(r.coordinates),
                "verse_refs": r.verse_refs,
                "color": r.color,
            }
            for r in routes
        ],
        "count": len(routes),
    }


@router.get("/maps/by-verse")
async def get_maps_by_verse(
    book: str = Query(...),
    chapter: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return places and routes related to a given book."""
    places_q = select(BiblicalPlace).where(
        or_(
            BiblicalPlace.verse_refs.ilike(f"%{book}%"),
            BiblicalPlace.description.ilike(f"%{book}%"),
        )
    )
    routes_q = select(JourneyRoute).where(
        or_(
            JourneyRoute.verse_refs.ilike(f"%{book}%"),
            JourneyRoute.description.ilike(f"%{book}%"),
        )
    )

    places_result = await db.execute(places_q)
    routes_result = await db.execute(routes_q)
    places = places_result.scalars().all()
    routes = routes_result.scalars().all()

    return {
        "places": [
            {
                "id": p.id,
                "place_name": p.place_name,
                "lat": p.lat,
                "lng": p.lng,
                "description": p.description,
                "verse_refs": p.verse_refs,
                "place_type": p.place_type,
            }
            for p in places
        ],
        "routes": [
            {
                "id": r.id,
                "route_name": r.route_name,
                "description": r.description,
                "coordinates": json.loads(r.coordinates),
                "verse_refs": r.verse_refs,
                "color": r.color,
            }
            for r in routes
        ],
    }
