default:
	mkdir -p build
	cp app.css build
	cp vendor/fireball.js build
	cat app.html pages/audio.html > build/index.html

www:
	( cd build; python -m SimpleHTTPServer 3000; )
