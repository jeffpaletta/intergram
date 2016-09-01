var tokenSet = false;
var verbose = false;

$(document).ready(function() {	

  //click clears

$("#submit").prop("disabled",true);
$("#submit").addClass("disabled");

 $('#username, #username_l, #password,  #password_l, #email, #email_f, #age, #city, #username_d, #password_d').on('click focusin', function() {
    this.value = '';
    $("#submit").prop("disabled",false);
    $("#submit").removeClass("disabled");
 });


  $('#signup').validate({
		onkeyup: false,
		rules: {
			password: {
				required: true,
				rangelength: [8,100]
			},
			username:{
				required: true,
				remote: {
					type: "POST",
                    url: "https://floodwatch.o-c-r.org/check_username/",
                    contentType: "application/json",
                    data: {
                    	username: function(){
                    		return $('#username').val();
                    	}
                    },
                    async: false
				} 
			},
      age: {
        number: true,
        min: 13,
        max: 120
      }
		},
    errorPlacement: function(error, element) {
      error.insertBefore( element );
    },
		messages: {
    		email: {
      		  required: "Please enter your email address",
            email: "Please enter a properly formatted email address"
    		},
    		password: {
      		  required: "Please enter a strong password",
            rangelength: "Password must be at least 8 characters"
    		},
    		username: {
    			required: "Please enter a username",
    			remote: "Username already taken, please choose another"
    		},
        age: {
            number: "Age must be numerical",
            min: "Sorry, the minimum age to use Floodwatch is 13",
            max: "Unless you're the world's oldest person, you're not entering a valid age!"
        }
      },
      submitHandler: function() {
      	var data = $('#signup').serializeJSON();
      	var password = data.password;
        data.gender = $('#gender').val()
        if (verbose) console.log(data.gender);
    	 $.ajax({
        url: "https://floodwatch.o-c-r.org/new_user/",
        type: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        safe: "True",
        success:function(result){
            if (verbose) console.log("success registering user: " + JSON.stringify(result));
            setToken(result.token);
        },
        error:function(xhr,status,error){
            if (verbose) console.log(status, error);
        }
  		});
  	  }
	});

  $('#login').validate({
    onkeyup: false,
    rules: {
      password_l: {
        required: true
      },
      username_l:{
        required: true
      }
    },
    messages: {
        password_l: {
            required: "Please enter your password"
        },
        username_l: {
          required: "Please enter a username"
        }
      },
      submitHandler: function() {
        var data = $('#login').serializeJSON();
        var password = data.password;
       $.ajax({
        url: "https://floodwatch.o-c-r.org/login_user/",
        type: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        safe: "True",
        success:function(result){
          if (result.token) {
            if (verbose) console.log("success logging in user: " + JSON.stringify(result));
            setToken_L(result.token);
          } else {
            $('#options').html("<p>Incorrect username or password. Please try logging in again.</p>");
          } 
        },
        error:function(xhr,status,error){
            if (verbose) console.log(status, error);
        }
      });
      }
  });

$('#delete_f').validate({
    onkeyup: false,
    rules: {
      password_d: {
        required: true
      },
      username_d:{
        required: true
      }
    },
    messages: {
        password_d: {
            required: "Please enter your password"
        },
        username_d: {
          required: "Please enter your username"
        }
      },
      submitHandler: function() {
        var data = $('#delete_f').serializeJSON();
        var password = data.password;
       $.ajax({
        url: "https://floodwatch.o-c-r.org/remove_user/",
        type: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        safe: "True",
        success:function(result){
            $('#explain').html("<p>Your account has been deleted</p>");
        },
        error:function(xhr,status,error){
            if (verbose) console.log(status, error);
            $('#explain').html("<p>We ran into an error deleting your account. Make sure you have the correct username and password, and please try again.</p>");
        }
      });
      }
  });

$('#download_f').validate({
    onkeyup: false,
    rules: {
      email_f: {
        required: true
      },
    },
    messages: {
        email_f: {
          required: "Please enter your email address."
        }
      },
      submitHandler: function() {
        var data = $('#download_f').serializeJSON();
        setTimeout(function(){
          $('#explain').html("<p>Thanks! Download email will be sent shortly.</p>");
           $('#download_f').hide();
        },500);
        chrome.extension.sendMessage({"whatKind":"downloadData", "data": data}, function(response){
          if (response.status == "success") {
            $('#explain').html("<p>Download email has been sent</p>");
          } else {
             $('#explain').html("<p>We ran into an error collecting your data. Make sure you entered the email you registered with, and reload the form to try again.</p>");
          }
        });
      }
  });

  setClick();
  $('#disclaim #signupBox').hide();

});


function setClick(){
  $('#retrieve').click(function(){
     chrome.tabs.getCurrent(function(tab){
      tokenSet = true;
      chrome.tabs.update(tab.id, {url: chrome.extension.getURL('retrieval.html')})
    }); 
  });
  $('#delete').click(function(){
     chrome.tabs.getCurrent(function(tab){
      tokenSet = true;
      chrome.tabs.update(tab.id, {url: chrome.extension.getURL('delete.html')})
    }); 
  });
  $('#showSignup').click(function(){
    $('#disclaim #signupBox').show();
    $('#showSignup').hide();
    $('#disclaim #retrieve').hide();
    $('#login').hide();
  });
}

$(window).on('beforeunload', function() {
  if (!tokenSet && !$('#explain').length) {
    chrome.extension.sendMessage({"whatKind":"popUpFalse"});
    return "Please log in or sign up. The extension will not be functional otherwise.";
  }
});

function setToken(token){
	chrome.extension.sendMessage( { "whatKind":"setUserToken", "token" : token }, function(status){
		$('#options').html("<p>Thanks! You are successfully registered.</p>");
    checkOptIn();
    tokenSet = true;
    setTimeout(function(){
      chrome.extension.sendMessage({ "whatKind":"popUpFalse"});
      chrome.tabs.getCurrent(function(tab){
        chrome.tabs.update(tab.id, {url: chrome.extension.getURL('history.html')})
      });
    },500);
	});
}

function setToken_L(token){
  chrome.extension.sendMessage( { "whatKind":"setUserToken", "token" : token }, function(status){
    $('#options').html("<p>Thanks! You are successfully logged in.</p>");
    checkOptIn();
    tokenSet = true;
    chrome.extension.sendMessage({"whatKind":"popUpFalse"});
    setTimeout(function(){chrome.tabs.getCurrent(function(tab){chrome.tabs.remove(tab.id)})}, 500);
  });
}

function checkOptIn(){
  chrome.extension.sendMessage( { "whatKind":"checkOptIn"}, function(){});
}

function setOptIn(){
  chrome.extension.sendMessage( { "whatKind":"setOptIn", "optIn" : "true"}, function(){});
}



