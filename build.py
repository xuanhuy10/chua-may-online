# Tạo public/index.html từ bản game chung (chua-may.html) cho bản tự chạy server
import re, sys
src = sys.argv[1]; s = open(src).read()
s = s.replace('<script>\n(() => {\n"use strict";', '<script src="/net.js"></script>\n<script>\n(() => {\n"use strict";', 1)
s = s.replace('Chia sẻ trang (nút Share) rồi gửi link cho bạn bè để cùng vào.', 'Gửi link trang này cho bạn bè để cùng vào, không cần tài khoản.')
s = re.sub(r'Thường do đang mở bằng link công khai mà chưa đăng nhập Claude[^"]*"', 'Server đang khởi động hoặc mất mạng, game sẽ tự nối lại."', s, count=1)
assert 'src="/net.js"' in s
HEAD = ('<!doctype html><html lang="vi"><head><meta charset="utf-8">'
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
  '<meta name="theme-color" content="#120d0b"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Chùa Mây">'
  '<style>html,body{margin:0;height:100%;overscroll-behavior:none;background:#120d0b}</style></head><body>\n')
if not s.lstrip().lower().startswith('<!doctype'): s = HEAD + s + '\n</body></html>\n'
open('public/index.html', 'w').write(s)
