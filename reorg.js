// DB.nearest_city()
// DB.play_experience('my_name', player)
// DB.record_experience(city, start_loc, song, 'my_name', recorder)
// DB::Recording.pause()
// DB::Recording.resume()
// DB::Recording.suggest()
// DB::Recording.accept()
// Player.on_paused()
// Player.on_played()
// Player.configure()
// Recorder.configure()
// Recorder.on_suggested()



var uid = F.push().name();





var FULL_TITLES = {
	rooster: "Dina Maccabees's \"The Rooster\""
};

function now(){ return (new Date()).getTime(); };

var current_role_name;
var current_walk;
var current_location;
var all_parts_snapshot;


function new_songwalk(){
	// in walks: set song and roles[]
	// in roles: set title, walk, city
	var song = prompt('Song:');
	if (!song) return;
	var role_count = Number(prompt('How many players?'));
	if (!role_count) return;
	var role_ids = [];
	var title = FULL_TITLES[song] + " for " + role_count + " players, at " + current_location;
	var walk = F.child('walks').push({
		title: title,
		song: song,
		city: "lax"
	});
	for (var i = 0; i < role_count; i++) {
		var role = F.child('roles').push({
			walk: walk.name(),
			city: 'lax',
			location: current_location,
			title: "Player " + (i+1) + " for " + FULL_TITLES[song]
		})
		walk.child('roles').push(role.name());
	};
}


function draw_parts(v){
	if (!v) v = all_parts_snapshot;
	all_parts_snapshot = v;
	$('#recordables').empty();
	$('#playables').empty();
	v.forEach(function(r){
		var role = r.val();
		if (role.location && current_location && current_location != role.location) return;
		if (!role.recorded_at){
			var title = "record " + role.title;
			var link = $('<a href="#">' + title + '</a>');
			link.appendTo('#recordables').on('click', function(){
				r.ref().child('recorded_at').set(now());
				current_role_name = r.name();
				attach_device_to_walk(F.child('walks').child(role.walk));
				configure_as_recorder();
				return false;
			});
		} else if (!role.taken_at || five_minutes_ago(role.taken_at)) {
			var title = "play " + role.title;
			var link = $('<a href="#">' + title + '</a>');
			link.appendTo('#playables').on('click', function(){
				beep();
				r.ref().child('taken_at').set(now());
				current_role_name = r.name();
				attach_device_to_walk(F.child('walks').child(role.walk));
				configure_as_player();
				return false;
			});			
		}
	});
}

function configure_as_recorder(){
	current_walk.child('roles').once('value', function(v){
		$('#message_buttons').empty();
		v.forEach(function(r){
			var role_name = r.val();
			var title = "Add instruction for " + role_name;
			if (role_name == current_role_name) title = "Add instruction for yourself";
			var link = $('<a href="#">' + title + '</a>');
			link.appendTo('#message_buttons').on('click', function(){
				add_instructions(role_name);
				return false;
			});
		});
		$('#annotation_controls').show();
	});

	current_walk.child('events').on('child_added', function(child){
		var instruction = child.val();
		if (instruction.role == current_role_name){
			// for me!
			// who sent it?
			var what;
			if (instruction.from == current_role_name){
				what = "<b>You</b> sent yourself an instruction: <br>";
			} else {
				what = "<b>" + instruction.from + "</b> sent an instruction: <br>";
			}
		  	$('#instructions').html(what + instruction.text);				
		  	beep();
		}
	});
}

function add_instructions(to_role){
	var audio = document.querySelector('audio');
	var text = prompt('What instructions?');
	if (!text) return;
	current_walk.child('events').push({
		from: current_role_name,
		role: to_role || current_role_name,
		t: audio.currentTime,
		text: text
	});
}

function five_minutes_ago(t){
	return now() - t > 20*1000;
}



function detach_device(){
	if (!current_walk) return;
	current_walk.child('song').off();
	InstrumentedAudio.unload();
	current_walk = null;
	$('#device').hide();
	$('#home').show();
	if (instructions){
		var cues = instructions.cues;
		for (var i = 0; i < cues.length; i++) {
			instructions.removeCue(cues[i]);
		};
	}
	$('#instructions').empty();
}





function configure_as_player(){
	$('#annotation_controls').hide();
	current_walk.child('is').set('paused:0');
}

// only when player!
function on_cue(e){
	if (e.text && e.role == current_role_name){
	  	$('#instructions').html(e.text);
	  	beep();
	}
}

function attach_device_to_walk(walk){
	detach_device();
	current_walk = walk;
	walk.once('value', function(v){
		var quest = v.val();
		InstrumentedAudio.load(quest.song + ".mp3", walk.child('is'), {
			cues: [quest.events, on_cue],
			onended: back,
			onload: function(){
				// loaded!
				$('#home').hide();
				$('#device').show();
			}
		})
	});
}


// 		if (instructions) instructions.addCue(new TextTrackCue(e.t, e.t+3, e.text));

	// instructions.oncuechange = function (){
	//   var cue = this.activeCues[0]; // assuming there is only one active cue
	// };



//// AUDIO STUFF ////
var audio = document.querySelector('audio');
var instructions;
if (audio.addTextTrack) instructions = audio.addTextTrack('descriptions');




InstrumentedAudio = {
	unloaders: [],

	init: function(){
		if (InstrumentedAudio.initted) return;
		InstrumentedAudio.initted = true;
		audio.addEventListener('play', function(){
			if (current_walk) current_walk.child('is').set('playing');
		})
		audio.addEventListener('pause', function(){
			if (current_walk) current_walk.child('is').set('paused');
		})
	},

	load: function (songName, controllerRef, options){
		if (!options) options = {};
		InstrumentedAudio.init();
		// TODO load the audio
		// TODO load the cues
		// TODO call the loaded cb
		InstrumentedAudio.unload();
		audio.src = songName;
		InstrumentedAudio.unloaders.push(function(){
			controllerRef.off();
		});
		InstrumentedAudio.current_controllerRef = controllerRef;
		controllerRef.on('value', function(s){
			var state = s.val() || 'paused:0';
			if (state == "playing") audio.play();
			else {
				audio.pause();
				if (state == "paused:0") audio.currentTime = 0;
			}
		});

		if (options.onended){
			audio.addEventListener('ended', options.onended);
			InstrumentedAudio.unloaders.push(function(){ 
				audio.removeEventListener('ended', options.onended);
			});
		}
	},

	unload: function(){
		audio.pause();
		InstrumentedAudio.unloaders.forEach(function(x){ x(); });
	}
};




var beep = (function () {
    var ctx = new(window.audioContext || window.webkitAudioContext);
    return function (duration, type, finishedCallback) {
    	if (!duration) duration = 200;
    	if (!type) type = 0;
        duration = +duration;
        type = (type % 5) || 0;  // Only 0-4 are valid types.
        if (typeof finishedCallback != "function") {
            finishedCallback = function () {};
        }
        var osc = ctx.createOscillator();
        osc.type = type;
        osc.connect(ctx.destination);
        osc.noteOn(0);
        setTimeout(function () {
            osc.noteOff(0);
            finishedCallback();
        }, duration);
    };
})();
