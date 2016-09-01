$(document).ready(function() {	
	$('#retrieval').validate({
		onkeyup: false,
		rules: {
			email: {
				required: true
			},
			username:{
				required: true,
		 },
    },
		messages: {
    		email: {
      		  required: "Please enter your email address",
               email: "Your email address must be in the format of name@domain.com"
    		},
    		username: {
    			required: "Please enter a username"
    		}
      },
      submitHandler: function() {
      	var data = $('#retrieval').serializeJSON();
    	 $.ajax({
        url: "https://floodwatch.o-c-r.org/reset_password/",
        type: "POST",
        data: JSON.stringify(data),
        contentType: "application/json",
        safe: "True",
        success:function(result){
            console.log("success sending retrieval email: " + JSON.stringify(result));
            $('#options').html("<p>We sent a new password to your email address. Please check to log in.</p>");
        },
        error:function(xhr,status,error){
            console.log(status, error);
            $('#options').html("<p>Sorry! That didn't work. Please try again, and make sure you submitted the correct username & email combo.</p>");
        }
  		});
  	  }
	});
});
