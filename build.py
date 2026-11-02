# Tạo public/index.html từ bản game chung (chua-may.html) cho bản tự chạy server
import re, sys
src = sys.argv[1]; s = open(src).read()
s = s.replace('<script>\n(() => {\n"use strict";', '<script src="/net.js"></script>\n<script>\n(() => {\n"use strict";', 1)
s = s.replace('Chia sẻ trang (nút Share) rồi gửi link cho bạn bè để cùng vào.', 'Gửi link trang này cho bạn bè để cùng vào, không cần tài khoản.')
s = re.sub(r'Thường do đang mở bằng link công khai mà chưa đăng nhập Claude[^"]*"', 'Server đang khởi động hoặc mất mạng, game sẽ tự nối lại."', s, count=1)
assert 'src="/net.js"' in s
open('public/index.html', 'w').write(s)
