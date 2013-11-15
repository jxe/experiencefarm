default:
	mkdir -p build
	cp app.css build
	cat app.html pages/audio.html > build/index.html
