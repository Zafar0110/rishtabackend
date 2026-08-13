[rishtabackend.adweb.host (18)] [adweruuv@server165 rishtabackend.adweb.host]$ cd ~/rishtabackend.adweb.host 
[rishtabackend.adweb.host (18)] [adweruuv@server165 rishtabackend.adweb.host]$ tail -n 40 stderr.log 
[TIMING] DB connect/reuse for POST /api/auth/login: 2293ms
[TIMING] Login - user lookup: 823ms
[TIMING] Login - bcrypt compare: 148ms
[TIMING] Login - token generation: 4ms
[TIMING] Login - TOTAL handler time: 977ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 261ms
[TIMING] Login - bcrypt compare: 151ms
[TIMING] Login - token generation: 1ms
[TIMING] Login - TOTAL handler time: 414ms
[TIMING] DB connect/reuse for POST /api/auth/login: 1ms
[TIMING] Login - user lookup: 257ms
[TIMING] Login - bcrypt compare: 124ms
[TIMING] Login - token generation: 2ms
[TIMING] Login - TOTAL handler time: 383ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 251ms
[TIMING] Login - bcrypt compare: 129ms
[TIMING] Login - token generation: 1ms
[TIMING] Login - TOTAL handler time: 381ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 251ms
[TIMING] Login - bcrypt compare: 121ms
[TIMING] Login - token generation: 1ms
[TIMING] Login - TOTAL handler time: 373ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 1777ms
[TIMING] Login - bcrypt compare: 131ms
[TIMING] Login - token generation: 4ms
[TIMING] Login - TOTAL handler time: 1912ms
[rishtabackend.adweb.host (18)] [adweruuv@server165 rishtabackend.adweb.host]$  curl -s -o /dev/null -w "Total round-trip time: %{time_total}s\n" -X POST                                               https://rishtabackend.adweb.host/api/auth/login -H "Content-Type: application/json" -d                                  '{"email":"admin@gmail.com","password":"123123123"}' 
Total round-trip time: 0.432985s
[rishtabackend.adweb.host (18)] [adweruuv@server165 rishtabackend.adweb.host]$  curl -s -o /dev/null -w "Total round-trip time: %{time_total}s\n" -X POST                                               https://rishtabackend.adweb.host/api/auth/login -H "Content-Type: application/json" -d                                  '{"email":"admin@gmail.com","password":"123123123"}' 
Total round-trip time: 0.386160s
[rishtabackend.adweb.host (18)] [adweruuv@server165 rishtabackend.adweb.host]$  curl -s -o /dev/null -w "Total round-trip time: %{time_total}s\n" -X POST                                               https://rishtabackend.adweb.host/api/auth/login -H "Content-Type: application/json" -d                                  '{"email":"admin@gmail.com","password":"123123123"}' 
Total round-trip time: 0.392829s
[rishtabackend.adweb.host (18)] [adweruuv@server165 rishtabackend.adweb.host]$ tail -n 40 stderr.log 
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 261ms
[TIMING] Login - bcrypt compare: 151ms
[TIMING] Login - token generation: 1ms
[TIMING] Login - TOTAL handler time: 414ms
[TIMING] DB connect/reuse for POST /api/auth/login: 1ms
[TIMING] Login - user lookup: 257ms
[TIMING] Login - bcrypt compare: 124ms
[TIMING] Login - token generation: 2ms
[TIMING] Login - TOTAL handler time: 383ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 251ms
[TIMING] Login - bcrypt compare: 129ms
[TIMING] Login - token generation: 1ms
[TIMING] Login - TOTAL handler time: 381ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 251ms
[TIMING] Login - bcrypt compare: 121ms
[TIMING] Login - token generation: 1ms
[TIMING] Login - TOTAL handler time: 373ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 1777ms
[TIMING] Login - bcrypt compare: 131ms
[TIMING] Login - token generation: 4ms
[TIMING] Login - TOTAL handler time: 1912ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 261ms
[TIMING] Login - bcrypt compare: 141ms
[TIMING] Login - token generation: 5ms
[TIMING] Login - TOTAL handler time: 408ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 254ms
[TIMING] Login - bcrypt compare: 109ms
[TIMING] Login - token generation: 1ms
[TIMING] Login - TOTAL handler time: 366ms
[TIMING] DB connect/reuse for POST /api/auth/login: 0ms
[TIMING] Login - user lookup: 253ms
[TIMING] Login - bcrypt compare: 118ms
[TIMING] Login - token generation: 0ms
[TIMING] Login - TOTAL handler time: 372ms
[rishtabackend.adweb.host (18)] [adweruuv@server165 rishtabackend.adweb.host]$ 