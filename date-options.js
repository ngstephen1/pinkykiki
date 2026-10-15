// Edit dates, times, venues, photos and pins here. Keep IDs stable for saved choices.
// coordinates: [latitude, longitude]. photo.source credits the original webpage.
// Photos of chain food and menu illustrations are labeled; they are not local interiors.
window.DATE_OPTIONS = {
    "location": {
        "name": "Virginia Tech · Blacksburg & Christiansburg",
        "weatherName": "Blacksburg, Virginia",
        "latitude": 37.22957,
        "longitude": -80.41394,
        "timezone": "America/New_York"
    },
    "dates": [
        "2026-10-16",
        "2026-10-17",
        "2026-10-18",
        "2026-10-19",
        "2026-10-20",
        "2026-10-21",
        "2026-10-22",
        "2026-10-23",
        "2026-10-24"
    ],
    "timeWindows": [
        {
            "id": "noon",
            "name": "Hẹn nhau buổi trưa",
            "range": "12–3 PM",
            "emoji": "🌤️",
            "detail": "Ăn ngon rồi thong thả đi chơi."
        },
        {
            "id": "afternoon",
            "name": "Một chiều dễ thương",
            "range": "3–6 PM",
            "emoji": "🌷",
            "detail": "Chút nắng chiều, chút rung rinh."
        },
        {
            "id": "evening",
            "name": "Date dưới ánh đèn",
            "range": "6–9 PM",
            "emoji": "🌆",
            "detail": "Bữa tối xinh và chuyện của tụi mình."
        },
        {
            "id": "night",
            "name": "Cú đêm cùng nhau",
            "range": "9–11 PM",
            "emoji": "🌙",
            "detail": "Một cuộc hẹn muộn, thật nhiều tâm sự."
        },
        {
            "id": "six-noon",
            "name": "Cả chiều dành cho Amy",
            "range": "12–6 PM",
            "emoji": "☀️",
            "detail": "6 giờ · ăn trưa, đi chơi, chụp ảnh. Thêm thời gian cho tụi mình ♡"
        },
        {
            "id": "six-afternoon",
            "name": "Từ nắng chiều đến tối",
            "range": "3–9 PM",
            "emoji": "💫",
            "detail": "6 giờ · thong thả dạo chơi, ăn tối rồi thêm một điểm hẹn xinh."
        }
    ],
    "restaurants": [
        {
            "id": "yeah-siam",
            "placeId": "yeah-siam",
            "name": "Yeah Siam Thai",
            "emoji": "🍛",
            "tag": "Thai · noodles & curry",
            "detail": "Drunken noodles, cà ri, thêm Thai tea. Một bữa ngon ngay downtown nha ♡"
        },
        {
            "id": "baan",
            "placeId": "baan",
            "name": "Baan Thai Blacksburg",
            "emoji": "🌶️",
            "tag": "Thai · cozy dinner",
            "detail": "Pad Thai hay cà ri nóng hổi, ăn xong mình ghé trà sữa bên cạnh nè."
        },
        {
            "id": "avellinos",
            "placeId": "avellinos",
            "name": "Avellinos Italian",
            "emoji": "🍕",
            "tag": "Italian · pizza & pasta",
            "detail": "Chia nhau pizza, pasta và thật nhiều chuyện nhỏ. A little Italian date?"
        },
        {
            "id": "kuma",
            "placeId": "kuma",
            "name": "Kuma Moon",
            "emoji": "🍜",
            "tag": "Japanese · ramen & boba",
            "detail": "Một tô ramen ấm áp, katsu hay boba — Amy chọn món, Milo chọn ngồi cạnh Amy."
        },
        {
            "id": "hefun",
            "placeId": "hefun",
            "name": "Hefun",
            "emoji": "🍣",
            "tag": "Japanese · sushi & ramen",
            "detail": "Sushi, ramen hay một chút trà. Thêm một lựa chọn xinh ở North Main."
        },
        {
            "id": "texas",
            "placeId": "texas",
            "name": "Texas Roadhouse",
            "emoji": "🥩",
            "tag": "Steakhouse · lively & fun",
            "detail": "Steak và bánh mì nóng với bơ quế mật ong. Hẹn một bữa thiệt vui nè!"
        },
        {
            "id": "olive",
            "placeId": "olive",
            "name": "Olive Garden",
            "emoji": "🍝",
            "tag": "Italian-American · comfort food",
            "detail": "Pasta, soup và breadsticks. Ngồi lâu thêm xíu để nghe Amy kể chuyện."
        },
        {
            "id": "sakura",
            "placeId": "sakura",
            "name": "Sakura Steak House",
            "emoji": "🥢",
            "tag": "Japanese · hibachi & sushi",
            "detail": "Hibachi, teriyaki hay sushi — món nào cũng muốn thử cùng Amy."
        }
    ],
    "activities": [
        {
            "id": "campus",
            "placeId": "drillfield",
            "name": "Dạo campus & chụp ảnh",
            "emoji": "🍂",
            "tag": "Outside · little memories",
            "detail": "Một vòng Drillfield, vài tấm ảnh và rất nhiều chuyện của tụi mình.",
            "outdoor": true
        },
        {
            "id": "hahn-garden",
            "placeId": "hahn-garden",
            "name": "Hahn Horticulture Garden",
            "emoji": "🌷",
            "tag": "Outside · a little garden date",
            "detail": "Dạo vườn cây, ngắm thác nước nhỏ và chụp vài tấm hình cùng Milo. Ghé lúc còn sáng nha ♡",
            "outdoor": true,
            "website": "https://www.tripadvisor.com/Attraction_Review-g57513-d6479638-Reviews-Hahn_Horticulture_Garden_at_Virginia_Tech-Blacksburg_Virginia.html"
        },
        {
            "id": "cafe",
            "placeId": "kft",
            "name": "Trà sữa ở Kung Fu Tea",
            "emoji": "🧋",
            "tag": "Boba · a sweet little stop",
            "detail": "Milk tea, matcha hay fruit tea? Một ly ngọt ngào sau bữa ăn nha.",
            "outdoor": false
        },
        {
            "id": "piano",
            "placeId": "squires",
            "name": "Piano & chill ở Squires",
            "emoji": "🎹",
            "tag": "Campus · music for two",
            "detail": "Ghé Squires, tìm góc piano khi có chỗ rồi ngồi bên nhau nghe nhạc ♡",
            "outdoor": false
        },
        {
            "id": "bowling",
            "placeId": "squires",
            "name": "Bowling ở BreakZONE",
            "emoji": "🎳",
            "tag": "Campus · playful date",
            "detail": "Bowling, billiards hay table tennis trong Squires. Thua cũng được, cười là thắng!",
            "outdoor": false,
            "website": "https://campuslife.vt.edu/student_centers/Squires/BreakZone.html"
        },
        {
            "id": "shopping",
            "placeId": "uptown",
            "name": "Đi dạo Uptown cùng nhau",
            "emoji": "🛍️",
            "tag": "Indoor · window shopping",
            "detail": "Dạo mall, xem vài món xinh rồi kể Milo nghe Amy thích gì nè.",
            "outdoor": false
        },
        {
            "id": "movie",
            "placeId": "regal",
            "name": "Xem phim ở Regal",
            "emoji": "🎬",
            "tag": "Cinema · two seats together",
            "detail": "Amy chọn phim, tụi mình chọn hai ghế cạnh nhau. Nhớ ngó suất chiếu nha.",
            "outdoor": false
        }
    ],
    "places": {
        "yeah-siam": {
            "name": "Yeah Siam Thai",
            "city": "Blacksburg",
            "cluster": "Downtown · Jackson St",
            "address": "104 Jackson St NE #100, Blacksburg, VA 24060",
            "coordinates": [
                37.230251,
                -80.414091
            ],
            "website": "https://www.yeahsiamthai.com/menu",
            "maps": "https://maps.app.goo.gl/cgHHbYFKg4GGMRef8",
            "photo": {
                "src": "assets/places/yeah-siam.webp",
                "alt": "Các món Thái trên trang menu của Yeah Siam",
                "credit": "Yeah Siam · Uber Eats",
                "source": "https://www.ubereats.com/store/yeah-siam/5nS_Bf1pU0yvcGhYKJWW-A",
                "kind": "Ảnh từ menu"
            }
        },
        "baan": {
            "name": "Baan Thai Blacksburg",
            "city": "Blacksburg",
            "cluster": "South Main · gần Kung Fu Tea",
            "address": "1202 S Main St, Blacksburg, VA 24060",
            "coordinates": [
                37.2187611,
                -80.4028151
            ],
            "website": "https://baanthaibburg.com/",
            "maps": "https://maps.app.goo.gl/eJPVAQrn7yTTi4xg8",
            "photo": {
                "src": "assets/places/baan.jpg",
                "alt": "Minh họa mặt tiền Baan Thai từ website của quán",
                "credit": "Baan Thai",
                "source": "https://baanthaibburg.com/",
                "kind": "Minh họa của quán"
            }
        },
        "avellinos": {
            "name": "Avellinos Italian Restaurant & Pizzeria",
            "city": "Blacksburg",
            "cluster": "South Main · First & Main",
            "address": "1440 S Main St #110, Blacksburg, VA 24060",
            "coordinates": [
                37.2140801,
                -80.4019611
            ],
            "website": "https://avellinosrestaurant.com/",
            "maps": "https://maps.app.goo.gl/x2xhhBcf8iuoX7zs5",
            "photo": {
                "src": "assets/places/avellinos.jpg",
                "alt": "Đĩa antipasto từ Avellinos",
                "credit": "Avellinos",
                "source": "https://avellinosrestaurant.com/",
                "kind": "Ảnh từ quán"
            }
        },
        "kuma": {
            "name": "Kuma Moon",
            "city": "Blacksburg",
            "cluster": "University City · phía tây campus",
            "address": "725 University City Blvd, Blacksburg, VA 24060",
            "coordinates": [
                37.2327695,
                -80.4335153
            ],
            "website": "https://www.kumamoon.us/",
            "maps": "https://maps.app.goo.gl/wJkWQj564dG2t4hV7",
            "photo": {
                "src": "assets/places/kuma-food.jpg",
                "alt": "Một tô ramen trên website Kuma Moon",
                "credit": "Kuma Moon",
                "source": "https://www.kumamoon.us/",
                "kind": "Ảnh từ quán"
            }
        },
        "hefun": {
            "name": "Hefun",
            "city": "Blacksburg",
            "cluster": "North Main · downtown",
            "address": "428 N Main St, Blacksburg, VA 24060",
            "coordinates": [
                37.231928,
                -80.4161125
            ],
            "website": "https://www.hefunblacksburgva.com/",
            "maps": "https://share.google/pyzPhHSnSjO0FnuV0",
            "photo": {
                "src": "assets/places/hefun.jpg",
                "alt": "Ảnh món Nhật minh họa trên menu trực tuyến của Hefun",
                "credit": "Hefun · Slice",
                "source": "https://www.hefunmenu.com/",
                "kind": "Minh họa từ menu"
            }
        },
        "texas": {
            "name": "Texas Roadhouse",
            "city": "Christiansburg",
            "cluster": "Uptown · Bradley Dr",
            "address": "100 Bradley Dr NW, Christiansburg, VA 24073",
            "coordinates": [
                37.1625428,
                -80.426337
            ],
            "website": "https://www.texasroadhouse.com/locations/143-christiansburgva",
            "maps": "https://maps.app.goo.gl/W9XGJJUKRoigEAoS6",
            "photo": {
                "src": "assets/places/texas.jpg",
                "alt": "Món steak Texas Roadhouse trong bài giới thiệu của The Takeout",
                "credit": "The Takeout",
                "source": "https://www.thetakeout.com/2257034/best-texas-roadhouse-entrees-we-found-under-20/",
                "kind": "Ảnh món của thương hiệu"
            }
        },
        "olive": {
            "name": "Olive Garden",
            "city": "Christiansburg",
            "cluster": "Uptown · North Franklin",
            "address": "2590 N Franklin St, Christiansburg, VA 24073",
            "coordinates": [
                37.1659389,
                -80.4238784
            ],
            "website": "https://www.olivegarden.com/locations/va/christiansburg/christiansburg-new-river-mall/1746",
            "maps": "https://maps.app.goo.gl/KSD7ctWcWLMPbhxu7",
            "photo": {
                "src": "assets/places/olive.jpg",
                "alt": "Chicken Alfredo trong ảnh món ăn chính thức của Olive Garden",
                "credit": "Olive Garden",
                "source": "https://www.olivegarden.com/alfredo-sauce",
                "kind": "Ảnh món của thương hiệu"
            }
        },
        "sakura": {
            "name": "Sakura Steak House",
            "city": "Christiansburg",
            "cluster": "Laurel St · gần khu Uptown",
            "address": "105 Laurel St, Christiansburg, VA 24073",
            "coordinates": [
                37.1626092,
                -80.4213403
            ],
            "website": "https://sakurajapan3christiansburg.com/",
            "maps": "https://maps.app.goo.gl/6engk12z5b6Q7JXb6",
            "photo": {
                "src": "assets/places/sakura.jpg",
                "alt": "Sushi trong thư viện ảnh của Sakura Steak House",
                "credit": "Sakura Steak House",
                "source": "https://sakurajapan3christiansburg.com/",
                "kind": "Ảnh từ menu"
            }
        },
        "kft": {
            "name": "Kung Fu Tea",
            "city": "Blacksburg",
            "cluster": "South Main · cạnh Baan Thai",
            "address": "1200 S Main St, Blacksburg, VA 24060",
            "coordinates": [
                37.2190396,
                -80.4032532
            ],
            "website": "https://www.kungfuteablacksburg.com/",
            "maps": "https://share.google/pF9mikU0uw7dOGHdM",
            "photo": {
                "src": "assets/places/kft.jpg",
                "alt": "Trà sữa và milk cap trong bộ ảnh quảng bá của Kung Fu Tea",
                "credit": "Kung Fu Tea Blacksburg",
                "source": "https://www.kungfuteablacksburg.com/Gallery",
                "kind": "Ảnh đồ uống của thương hiệu"
            }
        },
        "squires": {
            "name": "Squires Student Center",
            "city": "Blacksburg",
            "cluster": "Campus · College Ave",
            "address": "290 College Ave, Blacksburg, VA 24061",
            "coordinates": [
                37.2296781,
                -80.4179643
            ],
            "website": "https://campuslife.vt.edu/student_centers/Squires.html",
            "maps": "https://maps.app.goo.gl/wgTbouTSFDJFbswU6",
            "photo": {
                "src": "assets/places/squires.jpg",
                "alt": "Tòa nhà Squires Student Center tại Virginia Tech",
                "credit": "Virginia Tech",
                "source": "https://campuslife.vt.edu/student_centers/Squires.html",
                "kind": "Ảnh Squires · Virginia Tech"
            }
        },
        "uptown": {
            "name": "Uptown Christiansburg",
            "city": "Christiansburg",
            "cluster": "Uptown · New River Rd",
            "address": "782 New River Rd, Christiansburg, VA 24073",
            "coordinates": [
                37.1651702,
                -80.4266745
            ],
            "website": "https://uptownchristiansburg.com/",
            "maps": "https://maps.app.goo.gl/mjUqMpyGZYhaq8QG6",
            "photo": {
                "src": "assets/places/uptown.png",
                "alt": "Lối vào Uptown Christiansburg với mái xanh và biển hiệu của mall",
                "credit": "WDBJ7",
                "source": "https://www.wdbj7.com/2022/02/28/uptown-christiansburg-celebrates-re-branding-grand-opening/",
                "kind": "Ảnh địa điểm · WDBJ7"
            }
        },
        "regal": {
            "name": "Regal New River Valley",
            "city": "Christiansburg",
            "cluster": "Uptown · New River Rd",
            "address": "110 New River Rd, Christiansburg, VA 24073",
            "coordinates": [
                37.16373,
                -80.42874
            ],
            "website": "https://www.regmovies.com/theatres/regal-new-river-valley-0671",
            "maps": "https://maps.app.goo.gl/5JWt9rfYXedgFFqm6",
            "photo": {
                "src": "assets/places/regal.png",
                "alt": "Mặt tiền rạp Regal New River Valley ở Christiansburg",
                "credit": "WSLS / CJ 4DPLEX",
                "source": "https://www.wsls.com/news/local/2021/07/08/screenx-auditorium-opens-at-regal-new-river-valley-screenx-rpx/",
                "kind": "Ảnh địa điểm · WSLS"
            }
        },
        "hahn-garden": {
            "name": "Hahn Horticulture Garden",
            "city": "Blacksburg",
            "cluster": "Campus · Garden Lane",
            "address": "200 Garden Lane, Blacksburg, VA 24061",
            "coordinates": [
                37.219526,
                -80.424174
            ],
            "coordinateSource": "https://www.openstreetmap.org/way/54648973",
            "website": "https://hahngarden.vt.edu/visit.html",
            "maps": "https://share.google/zfSXLOILdziMjza2z",
            "photo": {
                "src": "assets/places/hahn-garden.jpg",
                "alt": "Thác nước nhỏ giữa cây xanh và đá tại Hahn Horticulture Garden",
                "credit": "Virginia Tech · Hahn Horticulture Garden",
                "source": "https://hahngarden.vt.edu/",
                "kind": "Ảnh khu vườn · Virginia Tech"
            }
        },
        "drillfield": {
            "name": "Drillfield · Virginia Tech",
            "city": "Blacksburg",
            "cluster": "Campus · Drillfield",
            "address": "Drillfield, Virginia Tech, Blacksburg, VA 24061",
            "coordinates": [
                37.22774,
                -80.42224
            ],
            "website": "https://www.vt.edu/about/locations/buildings/drillfield.html",
            "maps": "https://www.google.com/maps/search/?api=1&query=Drillfield+Virginia+Tech+Blacksburg",
            "photo": {
                "src": "assets/places/drillfield.jpg",
                "alt": "Bãi cỏ Drillfield và các tòa nhà của Virginia Tech",
                "credit": "Virginia Tech",
                "source": "https://www.vt.edu/about/locations/buildings/drillfield.html",
                "kind": "Ảnh campus · Virginia Tech"
            }
        }
    },
    "map": {
        "tileUrl": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        "attribution": "© <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener noreferrer\">OpenStreetMap</a> contributors",
        "maxZoom": 19
    }
}
