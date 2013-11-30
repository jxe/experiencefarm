var page = "home", searchq;
var F = new Firebase("http://songwalks.firebaseio.com/");
var current_sound, show_browse, page, show_compose, 
	next_flip_time, sorted_actions;
function $(x){ return document.getElementById(x); }

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
          indicator.innerHTML = "&#9654;";
          options.onplay=function(){ indicator.innerHTML = "&#10074;&#10074"; };
          options.onpause=function(){ indicator.innerHTML = "&#9654;"; };
          options.onresume=function(){ indicator.innerHTML = "i&#10074;&#10074;"; };
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
      '#actions': function(v){
         var actions = [];
         for (var k in v){ actions.push(v[k]); }
         sorted_actions = actions.sort(function(a,b){
            return a.t - b.t;
         });
         next_flip_time = null;
      },

      '#experience': function(v){
         //if (!v || !v.saved) $('timeline').className = 'editing';
         //else $('timeline').className = 'playing';

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

                 if (!next_flip_time || s >= next_flip_time){
                  // go thru all actions
                  // unflip all
                  // flip those that should be flip
                  // if there's one that's greater than the last
                  // store 5s before it in next flip time
                  // make the beep if it's next flip time
                 }

                 var actions = Fireball.latest('#actions');
                 for (var k in actions){
                    if (Math.abs(actions[k].t - s) > 5) $(k).style.backgroundColor = "black";
                    else $(k).style.backgroundColor = "white";
                 }
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
		var msg = "A " + exp.quality + " experience of &ldquo;" + exp.song_title + "&rdquo;.  ";
		if (exp.to_name) msg += "With <b>" + exp.to_name + "</b> in mind.  ";
		if (exp.author_name) msg += "By <b>" + (exp.author_name) + "</b>.  ";
		if (exp.placename) msg+= "Starting at &ldquo;" + exp.placename + "&rdquo;";
		return msg;
	}

         if (exp.to_name){
	         return "With <b>" + exp.to_name + "</b> in mind, <b>" + (exp.author_name || "Someone") + "</b>, came up with a way of enjoying &ldquo;" + exp.song_title + "&rdquo; starting at &ldquo;" + exp.placename + "&rdquo;";
         } else {
	         return "<b>" + (exp.author_name || "Someone") + "</b> has a way of enjoying &ldquo;" + exp.song_title + "&rdquo; starting at &ldquo;" + exp.placename + "&rdquo;";
         }
      },
      

      '#actions style': function(action){
         return "top: " + (action.t * 8 + 35) + "px";
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
      
      '.action': function(el){
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
	   
      "#rewind": function(){
         Player.current.sound.setPosition(0);
      },
      "#delete":function(){
         Fireball('#experience').remove();
         Fireball.set("$experience", null);
      },
      "#save":function(){
         Fireball('#experience').update({ saved: true });
      },
      "#edit":function(){
         Fireball('#experience').update({ saved: false });
      },
      "#play": function(){
         if (Player.current.sound) return Player.current.sound.togglePause();
         else return alert('No current sound');
      }
	}
	
});

