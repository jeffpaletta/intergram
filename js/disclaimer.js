var tokenSet = false;
var opt_in = false;
var verbose = false;

$(document).ready(function() {	


  //click clears

 $('#username, #username_l, #password,  #password_l, #email, #age, #city, #username_d, #password_d').on('click focusin', function() {
    this.value = '';
 });

  $('#signup').validate({
    debug: true,
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
			}
		},
    errorPlacement: function(error, element) {
      element.parent().append(error);
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
    		}
      },
      submitHandler: function() {
      	var data = $('#signup').serializeJSON();
        if (!opt_in){
          delete data.age;
          delete data.city;
        } else {
          data.gender = $('#gender').val();
           if (verbose) console.log(data.gender);
        }
      	var password = data.password;
        data.opt_in = opt_in;
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
  	  },
	});

  $('#login').validate({
    onkeyup: false,
    rules: {
      password_l: {
        required: true,
        rangelength: [6,100]
      },
      username_l:{
        required: true
      }
    },
    messages: {
        password_l: {
            required: "Please enter your password",
            rangelength: "Password needs to be at least 8 characters"
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
  $('#login_form').click(function(){
     chrome.tabs.getCurrent(function(tab){
      tokenSet = true;
      chrome.tabs.update(tab.id, {url: chrome.extension.getURL('login.html')})
    }); 
  });
  $('#showSignup').click(function(){
    $('#disclaim #signupBox').show();
    $('#showSignup').hide();
    $('#disclaim #retrieve').hide();
    $('#login').hide();
  }); 


  var $signup = $('#signupContainer');
  $('div.cta.optin, #signupContainer p.beware span').click(function(){
    $('html, body').animate({
      scrollTop: $("p.intro:nth-child(2)").offset().top
    }, 300);
    $signup.addClass('unfolded');
    $('#signupContainer p.beware').removeClass('unfolded');
    $signup.removeClass('halfUnfolded');
    opt_in = true;
    $("#age").rules("add", {
        number: true,
        min: 13,
        max: 120,
        messages: {
            number: "Age must be numerical",
            min: "Sorry, the minimum age to use Floodwatch is 13",
            max: "Unless you're the world's oldest person, you're not entering a valid age!"
        }
    });
    $('#signupContainer form div.row.optional').addClass('unfolded');
    $('#signupContainer h2').text('Sign up and share your data with floodwatch');
  }); 
  $('div.cta.optout').click(function(){
    $('html, body').animate({
      scrollTop: $("p.intro:nth-child(2)").offset().top
    }, 300);
    $signup.addClass('halfUnfolded');
    $('#signupContainer p.beware').addClass('unfolded');
    $signup.removeClass('unfolded');
    opt_in = false;
    $("#age").rules("remove");
    $('#signupContainer div.row.optional').removeClass('unfolded');
    $('#signupContainer h2').text('Sign up and keep your data on your computer');
    $('#signupContainer div.row.optional div.column:nth-child(2) input').val("Age");
    $('#signupContainer div.row.optional div.column:nth-child(3) input').val("City");
    $('#signupContainer div.row.optional select').val("NA");

  }); 

    $('#signupContainer div.row.required div.column:nth-child(2) input').blur(function(){
      if($(this).val() == '') $(this).val('Username');
    })
    $('#signupContainer div.row.required div.column:nth-child(3) input').blur(function(){
      if($(this).val() == '') $(this).val('Email Address');
    })
    $('#signupContainer div.row.required div.column:nth-child(4) input').blur(function(){
      if($(this).val() == '') $(this).val('password');
    })
    $('#signupContainer div.row.optional div.column:nth-child(2) input').blur(function(){
      if($(this).val() == '') $(this).val('Age');
    })
    $('#signupContainer div.row.optional div.column:nth-child(3) input').blur(function(){
      if($(this).val() == '') $(this).val('City');
    })

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

(function($) {
  
  var LOWER = /[a-z]/,
    UPPER = /[A-Z]/,
    DIGIT = /[0-9]/,
    DIGITS = /[0-9].*[0-9]/,
    SPECIAL = /[^a-zA-Z0-9]/,
    SAME = /^(.)\1+$/;
    
  function rating(rate, message) {
    return {
      rate: rate,
      messageKey: message
    };
  }
  
  function uncapitalize(str) {
    return str.substring(0, 1).toLowerCase() + str.substring(1);
  }
  
  $.validator.passwordRating = function(password, username) {
    if (!password || password.length < 8)
      return rating(0, "too-short");
    if (username && password.toLowerCase().match(username.toLowerCase()))
      return rating(0, "similar-to-username");
    if (SAME.test(password))
      return rating(1, "very-weak");

    var lower = LOWER.test(password),
      upper = UPPER.test(uncapitalize(password)),
      digit = DIGIT.test(password),
      digits = DIGITS.test(password),
      special = SPECIAL.test(password);
    
    if (lower && upper && digit || lower && digits || upper && digits || special)
      return rating(4, "strong");
    if (lower && upper || lower && digit || upper && digit)
      return rating(3, "good");
    return rating(2, "weak");
  }
  
  $.validator.passwordRating.messages = {
    "similar-to-username": "Too similar to username",
    "too-short": "Too short",
    "very-weak": "Very weak",
    "weak": "Weak",
    "good": "Good",
    "strong": "Strong"
  }
  
  $.validator.addMethod("password", function(value, element, usernameField) {
    // use untrimmed value
    var password = element.value,
    // get username for comparison, if specified
      username = $(typeof usernameField != "boolean" ? usernameField : []);
      
    var rating = $.validator.passwordRating(password, username.val());
    // update message for this field
    
    var meter = $(".password-meter", element.form);
    
    meter.find(".password-meter-bar").removeClass().addClass("password-meter-bar").addClass("password-meter-" + rating.messageKey);
    meter.find(".password-meter-message")
    .removeClass()
    .addClass("password-meter-message")
    .addClass("password-meter-message-" + rating.messageKey)
    .text($.validator.passwordRating.messages[rating.messageKey]);
    // display process bar instead of error message
    
    return rating.rate > 2;
  }, "&nbsp;");
  // manually add class rule, to make username param optional
  $.validator.classRuleSettings.password = { password: true };
  
})(jQuery);



