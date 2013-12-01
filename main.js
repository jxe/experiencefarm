var page = "home", searchq;
var F = new Firebase("http://songwalks.firebaseio.com/");
var current_sound, show_browse, page, show_compose, 
	next_flip_time, sorted_actions;
function $(x){ return document.getElementById(x); }

if (navigator.standalone) document.getElementsByTagName('body')[0].className = 'standalone';

var Player = {

   current: {},

   clear: function(){
      if (Player.current.sound){
         Player.current.sound.stop();
         Player.current.sound.unload();
      }
      if (Player.current.indicator) {
         Player.current.indicator.innerHTML = "&#9654;";
      }
      Player.current = {};
   },

   stream: function(method, track, indicator, options){
      if (Player.current.track) Player.clear();
      Player.current.track = track;
      Player.current.indicator = indicator;
      SC.stream(track, function(sound){
          Player.current.sound = sound;
          if (indicator){
             indicator.innerHTML = "&#9654;";
             options.onplay=function(){ indicator.innerHTML = "&#10074;&#10074"; };
             options.onpause=function(){ indicator.innerHTML = "&#9654;"; };
             options.onresume=function(){ indicator.innerHTML = "i&#10074;&#10074;"; };
          }
          sound[method](options || {});
      });
   }

};


Fireball(F, {
   map:{
      '#city'        : '/cities/$city',
      '#experience'  : '/experiences_in_city/$city/$experience',

      '#cities...'      : '/cities',
      '#experiences...' : '/experiences_in_city/$city',
      '#actions...'     : '/p2/actions/$experience',
      '#comments...'    : '/comments/$experience',

      "#results...": function(paint) {
	      if (!searchq || !Fireball.changed('searchq')) return;
	      SC.get('/tracks', { q: searchq }, function(tracks) {
            paint(tracks);
	      });
      }
   },

   on_update:{
      '#actions...': function(v){
         var actions = [];
         for (var k in v){ v[k].id = k; actions.push(v[k]); }
         sorted_actions = actions.sort(function(a,b){ return a.t - b.t; });
         next_flip_time = null;
      },

      '#experience': function(v){
         if (!v || !v.saved) $('experience').className = 'editing';
         else $('experience').className = 'playing';

         if (!v) return Fireball.refresh();
               
         if (v.duration){
            $('timeline').style.height = (v.duration * 8) + "px";
            $('waveform').style.webkitTransform = 
               "rotate(90deg) scale("+(v.duration * 8 / 1800)+",1.15)";
         }
               
         if (!v.soundcloud_url) return Fireball.refresh();

         $('play').innerHTML = "&#8230;";
         Player.stream('load', v.soundcloud_url, $('play'), {
            whileplaying: function(){
                 var s = Player.current.sound.position / 1000;
                 $('playhead').style.top = (s*8) + "px";

                 if (sorted_actions && (!next_flip_time || s >= next_flip_time)){
                    if (next_flip_time) beep();
                    var last_flipped;
                    for (var i = 0; i < sorted_actions.length; i++) {
                       var a = sorted_actions[i];
                       if (Math.abs(a.t - s) < 5) {
                          $(a.id).className = "show";
                          last_flipped = i;
                       } else {
                          $(a.id).className = "hide";
                       }
                    }
                    var next;
                    if (last_flipped !== undefined) {
                       next = sorted_actions[last_flipped+1];
                       if (next === undefined){
                          next_flip_time = s+10000;
                       } else {
                          next_flip_time = next.t - 5;
                       }
                    }
                 }

                 //var actions = Fireball.latest('#actions');
                 //for (var k in actions){
                 //   if (Math.abs(actions[k].t - s) > 5) $(k).style.backgroundColor = "black";
                 //   else $(k).style.backgroundColor = "white";
                 //}
            }
        });
	},

	'#experiences': function(v){
		 if (!v) {
			$("count_string").innerHTML = "No experiences yet"
		 } else {
			 $("count_string").innerHTML = Object.keys(v).length + " experiences";
		 }
	}
   },
   
   init:function(){
      SC.initialize({client_id: "43963acff2ef28ec55f039eddcea8478"});
      var m = location.href.match(/experience\/(.*)$/);
      if (m) Fireball.set('$experience', m[1]);
   },

   on_submit:{
      'form': function(){}
   },
   
   on_change:{
      '#quality': function(q){
         Fireball('#experience').update({quality: q.value});
      },
      '#placename': function(pn){
         Fireball('#experience').update({placename: pn.value});
      },
      //   properties.author_name = form.author_name.value;
      //   properties.to_name = form.to_name.value;
      '#search input': function(q){ searchq = q.value; }
   },
   

   calculated_fields:{
      "#experience googlemap": function(exp){
         if (!exp.start_loc) return "<a href='#' id='geolocate'>Geolocate!</a>";
         var mapUrl = "http://maps.google.com/maps/api/staticmap?markers=";
         mapUrl = mapUrl + exp.start_loc[0] + ',' + exp.start_loc[1];
         mapUrl = mapUrl + '&zoom=16&size=320x100&maptype=roadmap&sensor=true&key=AIzaSyA51bUQ2qrcA4OqxkBVktwFkxH9XEqcG3A';
         return "<img src='"+mapUrl+"'>";
      },
      
      "#experiences calctitle": function(exp){
         // TODO: make from start loc name and song name and authors

	if (exp.quality){
		var msg = "An <b>#" + exp.quality + "</b> experience, set to <b>&ldquo;" + exp.song_title + "&rdquo;</b>. ";
		if (exp.to_name) msg += "with <b>" + exp.to_name + "</b> in mind.  ";
		if (exp.placename) msg+= "<br>starts <b>" + exp.placename + "</b>";
		if (exp.author_name) msg += ", by <b>" + (exp.author_name) + "</b>.  ";
      else msg += ".";
		return msg;
	}

         if (exp.to_name){
	         return "With <b>" + exp.to_name + "</b> in mind, <b>" + (exp.author_name || "Someone") + "</b>, came up with a way of enjoying &ldquo;" + exp.song_title + "&rdquo; starting at &ldquo;" + exp.placename + "&rdquo;";
         } else {
	         return "<b>" + (exp.author_name || "Someone") + "</b> has a way of enjoying &ldquo;" + exp.song_title + "&rdquo; starting at &ldquo;" + exp.placename + "&rdquo;";
         }
      },
      

      '#actions style': function(action){
         return "top: " + (action.t * 8 + 5) + "px";
      }
   },
   
   show_when:{
      '#experience': function(){ return Fireball.get('$experience'); },

      '.saved': function(){
         var latest = Fireball.latest('#experience');
         return latest && latest.saved; 
      },
      '.notsaved': function(){
         var latest = Fireball.latest('#experience');
         return latest && !latest.saved; 
      },
      '.hassong': function(){
         var latest = Fireball.latest('#experience');
         return latest && latest.song_title; 
      },
      '.nosong': function(){
         var latest = Fireball.latest('#experience');
         return latest && !latest.song_title; 
      },
      "#choose_city": function(){ return !Fireball.get("$city"); },
      "#city": function(){ return Fireball.get("$city") && !Fireball.get('$experience'); }
   },

   on_click: {
	"#results a .choose_song": function(b){
		var data = b.parentNode.parentNode.data;
		Fireball('#experience').update({
                     soundcloud_url: "/tracks/" + data.id,
                     soundcloud_id: data.id,
                     waveform_url: data.waveform_url,
                     song_title: data.title,
                     duration: data.duration / 1000
		});
	},

	"#results a": function(a){
		var data = a.data;
      Player.stream('play', '/tracks/' + data.id);
	},


      "#share": function(){
         var url = "http://experiencefarm.org/#!experience/" + Fireball.get('$experience');
         url = encodeURIComponent(url);
         window.location = "mailto:?subject=I%20made%20you%20a%20thing&body="+url;
      },
      "#add_comment": function(){
         var comment = prompt('comment:');
         if (!comment) return;
         Fireball('#comments').push({ text: comment });
      },
      "#experiences li": function(el){
         beep();
         Fireball.set('$experience', el.id);
      },

      "#new_experience": function(){
         navigator.geolocation.getCurrentPosition(function(pos){
            var id = Fireball('#experiences').push({ 'start_loc': [
               pos.coords.latitude, pos.coords.longitude
            ]}).name();
            Player.clear();
            Fireball.set('$experience', id);
         });
      },
      "#browse": function(){ Fireball.set('$experience', null);  },
      "#change_city": function(){ Fireball.set('$city', null); },
      "#cities a": function(el){ Fireball.set('$city', el.id); },
      
      '#actions>a': function(el){
         var latest = Fireball.latest('#experience');
         if (latest && latest.saved) return;
         var sure = confirm("Do you want to delete this instruction?");
	      if (sure) Fireball('#actions').child(el.id).remove();
      },
	
      '#add_action button': function(el){
         var new_action = prompt('What:');
         if (new_action) Fireball('#actions').push({
            t: Player.current.sound.position / 1000,
            type: el.innerText,
            text: new_action
         });
      },
          
      '#new_city': function(){
	      var name = prompt('City:');
	      if (name) Fireball('#cities').push({name:name});
      },
		   
      '#geolocate':function(){
         var latest = Fireball.latest('#experience');
         if (latest && latest.saved) return;
         navigator.geolocation.getCurrentPosition(function(pos){
            Fireball('#experience').update({ 'start_loc': [
               pos.coords.latitude, pos.coords.longitude
            ]});
         });
	   },
      "#edit":function(){
         Fireball('#experience').update({ saved: false });
      },
      "#save":function(){
         Fireball('#experience').update({ saved: true });
      },
	   
      "#delete":function(){
         Fireball('#experience').remove();
         Fireball.set("$experience", null);
      },
      ".rewind": function(){
         if (Player.current.sound) Player.current.sound.setPosition(0);
      },
      "#play": function(){
         if (Player.current.sound) return Player.current.sound.togglePause();
         else return alert('No current sound');
      }
	}
	
});

var beep = (function () {
   var ctx = new(window.audioContext || window.webkitAudioContext);
   return function (duration, type, finishedCallback) {
      if (!duration) duration = 100;
      if (!type) type = 0;
      duration = +duration;
      type = (type % 5) || 0;  // Only 0-4 are valid types.
      if (typeof finishedCallback != "function") {
         finishedCallback = function () {};
      }
      var osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = 880*2.0;
      osc.connect(ctx.destination);
      osc.noteOn(0);
      setTimeout(function () { osc.noteOff(0); finishedCallback(); }, duration);
   };
})();

