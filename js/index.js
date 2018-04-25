function join() {
	var roomInput = $("#roomInput").val();
	window.location.replace("http://localhost:8080/" + roomInput);
}
function generateID() {
	$.get("http://localhost:8080/newroom", function(data, status){
		if (status == 'success') {
			window.location.replace("http://localhost:8080/" + data);
		}
		else {
			console.log(status);
		}
	});
}