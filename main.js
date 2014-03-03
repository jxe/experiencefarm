var page = "explore", searchq;
var F = new Firebase("http://songwalks.firebaseio.com/");
var page, next_flip_time, sorted_actions, sort, show_genres, playlist, action_type;
var curloc, curplace, now_playing, has_played_song;
var sessionid = Math.floor(Math.random()*100000000);

function $(x){ return document.getElementById(x); }
function values(obj){ return Object.keys(obj).map(function(x){ return obj[x]; }); }
function conjoin(components){
  if (components.length == 0) return "";
  if (components.length == 1) return components[0];
  if (components.length == 2) return components[0] + " and " + components[1];
  return components.slice(0,-1).join(', ') + ", and " + components[components.length - 1];
}
function more_than_30m_ago(ts){
  return (new Date().getTime()) - ts > 30*60*1000;
}
function set_active_tab(a){
  // var a = $(domid);
  var tabs = a.parentNode.childNodes;
  for (var i = 0; i < tabs.length; i++) tabs[i].classList && tabs[i].classList.remove('active');
  a.classList.add('active');
}


if (navigator.standalone) document.getElementsByTagName('body')[0].className = 'standalone';


function with_loc(f){
  navigator.geolocation.getCurrentPosition(
    function(pos){
      curloc = [ pos.coords.latitude, pos.coords.longitude ];
      store_loc();
      f(pos);
    }, function(err) {
      console.warn('ERROR(' + err.code + '): ' + err.message);
      alert('Unable to get your location.  Currently this is required.');
    }, {
      timeout: 10*1000,
      maximumAge: 1000*60*10,
      enableHighAccuracy: true
    }
  );
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function distance(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}


function store_loc(){
  if (curloc){
    var now = (new Date()).getTime();
    localStorage['loc'] = JSON.stringify({ loc: curloc, at: now });
  }
}

function restore_loc(){
  var data;
  if (data = localStorage['loc']){
    data = JSON.parse(data);
    var now = (new Date()).getTime();
    if (now - data.at < 1000*60*6){
      curloc = data.loc;

      // $('top_location').innerHTML = "You're at UNKNOWN LOCATION";
      // var mapUrl = "http://maps.google.com/maps/api/staticmap?markers=size:tiny%7C";
      // mapUrl = mapUrl + curloc[0] + ',' + curloc[1];
      // mapUrl = mapUrl + '&zoom=16&size=264x60&maptype=roadmap&sensor=true&key=AIzaSyA51bUQ2qrcA4OqxkBVktwFkxH9XEqcG3A';
      // $('top_map').style.backgroundImage = "url(" + mapUrl + ")";
    }
  }
}


restore_loc();

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
          if (!sound || !sound[method]) { console.log(sound); return; }
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

function nextSong(){
  if (!playlist || playlist.errors || playlist.length == 0) return;
  var data = now_playing = playlist.pop();
  var song_info = {
     'start_loc': curloc,
     soundcloud_url: "/tracks/" + data.id,
     soundcloud_id: data.id,
     waveform_url: data.waveform_url,
     song_title: data.title,
     duration: data.duration / 1000,
     created_at: (new Date()).getTime()
  };
  var current_experience = Fireball.latest('#experience');
  if (!current_experience) {
    if (curplace) song_info.placename = curplace;
    var id = Fireball('#experiences').push(song_info).name();
    Player.clear();
    Fireball.set('$experience', id);
    page = 'listen';
    set_active_tab($('go_listen'));
    Fireball.refresh();
  } else if (!current_experience.notice_count && !current_experience.placename) {
    Fireball('#experience').update(song_info);
  } else {
    Fireball.set('$experience', null);
    Player.clear();
  }
}

function reflip(){
   if (!Player.current.sound || !sorted_actions) return;
   if (!Player.current.sound.position) return;
   var s = Player.current.sound.position / 1000;
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
   return last_flipped;
}


Fireball(F, {
   map:{
      '#experience'  : '/pairings/$experience',
      '#experiences...' : ['/pairings', function(obj){
        var data = [];
        for (var k in obj) {
          var exp = obj[k];
          obj[k].id = k; 
          if ((sort != 'nearby') || distance(exp.start_loc[0], exp.start_loc[1], curloc[0], curloc[1]) < 25)
            data.push(obj[k]);
        }
        return data.sort(function(a,b){ return (b.created_at||0) - (a.created_at||0); });
      }],
      '#actions...'     : '/p2/actions/$experience',
      // '#comments...'    : '/comments/$experience',

      '#now_playing_section' : function(paint){
        if (now_playing) paint({ title: now_playing.title });
      },

      "#results...": function(paint) {
         if (!Fireball.changed('searchq')) return;
	      if (!searchq) return paint([]);
	      SC.get('/tracks', { q: searchq }, function(tracks) {
            paint(tracks);
	      });
      }
   },

   on_update:{
      '#actions...': function(v){
         var actions = [];
         var not_by_me;
         for (var k in v){
           v[k].id = k; 
           actions.push(v[k]);
           if (v[k].seen && !v[k].seen[sessionid]) not_by_me = true;
         }
         sorted_actions = actions.sort(function(a,b){ return a.t - b.t; });
         next_flip_time = null;
         reflip();
         if (not_by_me) beep();
      },

      '#experience': function(v){
         searchq = null; 

         if (!v){
            $('playhead').style.left = 0;
            return Fireball.refresh();
         }
         
         // $('top_location').innerHTML = "You're at " + v.placename;
         // var mapUrl = "http://maps.google.com/maps/api/staticmap?markers=size:tiny%7C";
         // mapUrl = mapUrl + v.start_loc[0] + ',' + v.start_loc[1];
         // mapUrl = mapUrl + '&zoom=16&size=264x60&maptype=roadmap&sensor=true&key=AIzaSyA51bUQ2qrcA4OqxkBVktwFkxH9XEqcG3A';
         // $('top_map').style.backgroundImage = "url(" + mapUrl + ")";

         if (!more_than_30m_ago(v.created_at)) $('experience').className = 'editing';
         else $('experience').className = 'playing';
         if (!v.soundcloud_url) return Fireball.refresh();
         if (Player.current.track == v.soundcloud_url) return Fireball.refresh();

         has_played_song = null;

         $('play').innerHTML = "&#8230;";
         Player.stream('load', v.soundcloud_url, $('play'), {
            whileplaying: function(){
                 var s = Player.current.sound.position / 1000;
                 var percent = Player.current.sound.position / Player.current.sound.duration;
                 var px = percent * 320;
                 $('playhead').style.left = (px) + "px";
                 if (sorted_actions && (!next_flip_time || s >= next_flip_time)){
                    if (next_flip_time) beep();
                    var last_flipped = reflip();
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
      if (m) {
        Fireball.set('$experience', m[1]);
        page = 'listen';
        set_active_tab($('go_listen'));
      }
   },

   on_submit:{
      'form': function(){}
   },
   
   on_change:{
      // "#add_comment": function(q){
      //    Fireball('#comments').push({ text: q.value });
      // },

      '#quality': function(q){
         Fireball('#experience').update({quality: q.value});
      },
      '#placename': function(pn){
         Fireball('#experience').update({placename: pn.value});
      },

      '#add_sugg': function(input){
         var actions = Fireball.latest('#actions...');
         var seen = {};
         seen[sessionid] = (new Date()).getTime();

         action_type = action_type || "i_feel";

         Fireball('#actions').push({
            t: Player.current.sound.position / 1000,
            type: action_type,
            text: input.value,
            seen: seen
         });

         if (action_type == 'i_feel'){
            Fireball('#experience').child('feelings').push(input.value);
         }

         var count = actions ? Object.keys(actions).length : 0;
         Fireball('#experience').update({ 'notice_count': count + 1 });
         input.value = '';
         input.blur();
      },

      //   properties.author_name = form.author_name.value;
      //   properties.to_name = form.to_name.value;
      '#search_input': function(q){
        searchq = q.value;
      }
   },
   

   calculated_fields:{

      "#experiences placename_or_unknown": function(exp){
        return exp.placename || "Unknown Location";
      },

      "#experiences expnotices": function(exp){
         var dist = "";
         if (curloc && exp.start_loc) {
           var km = distance(exp.start_loc[0], exp.start_loc[1], curloc[0], curloc[1]);
           if (km < 1){
              dist = "<b>close to your location</b>"
           } else {
              dist = "<b>" + Math.floor(km) + " km</b> away";
           }
         }

         if (exp.feelings){
           var f = values(exp.feelings)[0].split(' ')[0];
           return "<b>" + f +"</b>, " + dist;
         }
         else if (exp.song_title) return dist;
         // if (exp.notice_count) components.push("noticed <b>" + exp.notice_count + "</b> things");
      },

      "#experiences expstyle": function(exp){
        return "";
         // if (!exp.start_loc) return "";
         // var mapUrl = "http://maps.google.com/maps/api/staticmap?markers=size:tiny%7C";
         // mapUrl = mapUrl + exp.start_loc[0] + ',' + exp.start_loc[1];
         // mapUrl = mapUrl + '&zoom=16&size=264x60&maptype=roadmap&sensor=true&key=AIzaSyA51bUQ2qrcA4OqxkBVktwFkxH9XEqcG3A';
         // return "background-image: url(" + mapUrl + ");";
      },

      "#experience expstyle": function(exp){
         if (!exp.start_loc) return "";
         var mapUrl = "http://maps.google.com/maps/api/staticmap?markers=size:tiny%7C";
         mapUrl = mapUrl + exp.start_loc[0] + ',' + exp.start_loc[1];
         mapUrl = mapUrl + '&zoom=16&size=264x60&maptype=roadmap&sensor=true&key=AIzaSyA51bUQ2qrcA4OqxkBVktwFkxH9XEqcG3A';
         return "background-image: url(" + mapUrl + ");";
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

      '#actions button': function(action){
        if (action.seen[sessionid]){
          var seen_by_count = Object.keys(action.seen).length;
          if (seen_by_count == 1) return '';
          return "<i>them too!</i>"; // + (seen_by_count - 1)
        }
        return '<button>Me too</button>';
      },

      '#actions waveform_url': function(action){
         var l = Fireball.latest('#experience'); 
         return l && l.waveform_url;
      },

      '#actions style': function(action){
         var l = Fireball.latest('#experience'); 
         return "background-image: url(" + l.waveform_url + ")";
         // return "top: " + (action.t * 8 + 5) + "px";
      },

      '#actions barstyle': function(action){
         var l = Fireball.latest('#experience'); 
         var percent = action.t / l.duration;
         return "left:" + percent*320;
        // return "top: " + (action.t * 8 + 5) + "px"; 
      }
   },
   
   show_when:{
      '.hasloc': function(){ return curloc; },
      '.noloc': function(){ return !curloc; },
      '#search_input': function(){ return !now_playing; },
      '#genres': function(){ return show_genres; },
      '#now_playing_section': function(){ return now_playing; },
      '#pick_song': function(){ return searchq; },
      '#tab_listen, .listen': function(){ return page=='listen'; },
      '#tab_explore': function(){ return page == 'explore'; },
      // '#city': function(){ return !Fireball.get('$experience'); },
      // '#experience': function(){ return Fireball.get('$experience'); },

      '.authoring':function(){
         var latest = Fireball.latest('#experience');
         if (!latest) return false;
         if (!more_than_30m_ago(latest.created_at)) return true;
         return false;
      },

      '.locked':function(){
         var latest = Fireball.latest('#experience');
         if (!latest) return true;
         if (!more_than_30m_ago(latest.created_at)) return false;
         if (latest.song_title && !has_played_song) return true;
         var km = distance(latest.start_loc[0], latest.start_loc[1], curloc[0], curloc[1]);
         if (km > 1) return true;
         return false;
      },

      '.authoring_or_unlocked':function(){
         var latest = Fireball.latest('#experience');
         if (!latest) return false;
         if (!more_than_30m_ago(latest.created_at)) return true;
         if (latest.song_title && !has_played_song) return false;
         var km = distance(latest.start_loc[0], latest.start_loc[1], curloc[0], curloc[1]);
         if (km > 1) return false;
         return true;
      },

      '.unlocked':function(){
         var latest = Fireball.latest('#experience');
         if (!latest) return false;
         if (!more_than_30m_ago(latest.created_at)) return false;
         if (latest.song_title && !has_played_song) return false;
         var km = distance(latest.start_loc[0], latest.start_loc[1], curloc[0], curloc[1]);
         if (km > 1) return false;
         return true;
      },

      '.close_enough':function(){
         var latest = Fireball.latest('#experience');
         if (!latest) return false;
         var km = distance(latest.start_loc[0], latest.start_loc[1], curloc[0], curloc[1]);
         if (km > 1) return false;
         return true;
      },
      '.not_close_enough':function(){
         var latest = Fireball.latest('#experience');
         if (!latest) return false;
         var km = distance(latest.start_loc[0], latest.start_loc[1], curloc[0], curloc[1]);
         if (km > 1) return true;
         return false;
      },

      '.saved': function(){
         var exp = Fireball.latest('#experience');
         return exp && more_than_30m_ago(exp.created_at);
      },
      '.notsaved': function(){
         var exp = Fireball.latest('#experience');
         return exp && !more_than_30m_ago(Fireball.latest('#experience').created_at);
      },
      '.hassong': function(){
         var latest = Fireball.latest('#experience');
         return latest && latest.song_title; 
      },
      '.nosong': function(){
         var latest = Fireball.latest('#experience');
         return !latest || !latest.song_title; 
      }
   },

   on_click: {

    "#go_explore": function(a){
      Fireball.set("$experience", null);
      page = 'explore';
    },
    "#go_listen": function(a){
        var song_info = { start_loc: curloc, created_at: (new Date()).getTime() };
        if (curplace) song_info.placename = curplace;
        var id = Fireball('#experiences').push(song_info).name();
        Player.clear();
        Fireball.set('$experience', id);
        page = 'listen';
        Fireball.refresh();
    },

    "#genres a": function(a){
      var genre = a.innerHTML;
      show_genres = false;
      SC.get('/tracks', { genres: genre, order: 'hotness' }, function(tracks) {
        if (!tracks) return alert('no songs in that genre!');
        if (tracks.errors) { console.log(tracks);  return('attempt to fetch songs failed'); }
        playlist = shuffleArray(tracks);
        nextSong();
      });
    },
    '#stop': function(){
      Player.clear(); now_playing = null;
    },
    '#fast_forward': function(){ nextSong(); },


   	"#results a": function(a){
   		var data = a.data;
      now_playing = data;
      searchq = null;
      Player.stream('play', '/tracks/' + data.id);
   	},


      "#share": function(){
         var url = "http://experiencefarm.org/#!experience/" + Fireball.get('$experience');
         url = encodeURIComponent(url);
         window.location = "mailto:?subject=I%20made%20you%20a%20thing&body="+url;
      },

      "#experiences .experience_tile": function(el){
         beep();
         Fireball.set('$experience', el.id);
         page = 'listen';
         set_active_tab($('go_listen'));
      },

      '.show_genres': function(){
        show_genres = !show_genres;
      },

      '#sort_latest': function(a){
        set_active_tab(a);
        sort = 'latest';
        Fireball.refresh('#experiences...');        
      },

      '.fake_action .tabs a': function(a){
        set_active_tab(a);
        action_type = a.id;
        if (action_type == 'i_will') $('add_sugg').setAttribute('placeholder', "What will you do?");
        if (action_type == 'i_walk') $('add_sugg').setAttribute('placeholder', "Where will you walk?");
        if (action_type == 'i_notice') $('add_sugg').setAttribute('placeholder', "What do you notice, nearby?");
        if (action_type == 'i_feel') $('add_sugg').setAttribute('placeholder', "What do you feel?");
        setTimeout(function(){ $('add_sugg').focus(); }, 400)
      },

      '#sort_nearby': function(a){
        set_active_tab(a);
        if (curloc) {
            sort = 'nearby';
            Fireball.refresh('#experiences...');
            return
        }
        with_loc(function(pos){
            sort = 'nearby';
            Fireball.refresh();
            Fireball.refresh('#experiences...');
        });
      },
      
      '#actions span button': function(button){
        var link = button.parentNode.parentNode;
        var obj = {};
        obj[sessionid] = (new Date()).getTime();
        Fireball('#actions').child(link.id).child('seen').update(obj);
      },

      '#actions>a': function(el){
         if (more_than_30m_ago(Fireball.latest('#experience').created_at)) return;
         var sure = confirm("Do you want to delete this instruction?");
	       if (!sure) return;
         var actions = Fireball.latest('#actions...');
         Fireball('#actions').child(el.id).remove();
         var count = actions ? Object.keys(actions).length : 0;
         Fireball('#experience').update({ 'notice_count': count - 1 });
      },
	  	     
      "#delete":function(){
         var sure = confirm("Do you want to delete this soundtrack?");
         if (!sure) return;
         Fireball('#experience').remove();
         Fireball.set("$experience", null);
         page = 'explore';
         set_active_tab($('go_explore'));
         Player.clear(); now_playing = null;
      },

      ".rewind": function(){
         if (Player.current.sound) Player.current.sound.setPosition(0);
         $('playhead').style.left=0;
         reflip();
      },
      "#play": function(){
         if (Player.current.sound) return Player.current.sound.togglePause();
         else return alert('No current sound');
      },

      '#map_clicked':function(){
         if (more_than_30m_ago(Fireball.latest('#experience').created_at)) return;
         if (!confirm('Update map?')) return;
         with_loc(function(pos){
            Fireball('#experience').update({ 'start_loc': [
               pos.coords.latitude, pos.coords.longitude
            ]});
         });
	   }
	}
	
});

var beep = (function () {
   var ctx = new(window.audioContext || window.webkitAudioContext);
   return function (duration, type, finishedCallback) {
      if (!duration) duration = 60;
      if (!type) type = 0;
      duration = +duration;
      type = (type % 5) || 0;  // Only 0-4 are valid types.
      if (typeof finishedCallback != "function") {
         finishedCallback = function () {};
      }

      var osc = ctx.createOscillator();
      //var reverb = ctx.createConvolver();
      var gain = ctx.createGainNode();
      gain.gain.value = 0.17;
      osc.type = type;
      osc.frequency.value = 880*1.5;
      osc.connect(gain);
      //osc.connect(reverb);
      //reverb.connect(gain);
      gain.connect(ctx.destination);

      osc.noteOn(0);
      setTimeout(function () { osc.noteOff(0); finishedCallback(); }, duration);
   };
})();

