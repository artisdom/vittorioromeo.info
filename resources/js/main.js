var colorMain = "rgb(160, 160, 160)";
var colorBlank = "rgb(255, 255, 255)";
var colorAccent = "rgb(6, 174, 189)";
var animSpeed = 160;
$(document).scroll(function() {
    var b = $(document).scrollTop() >= 80;
    $(".mainMenu").toggleClass("fixedMainMenu", b);
    if(b)
    {
        $(".main").css({"margin-top" : "80px"})
    }
    else
    {
        $(".main").css({"margin-top" : "0px"})
    }
});
$(".menuButton")
    .hover(
        function() {
            $(this).stop().animate({backgroundColor : colorBlank}, animSpeed);
            $(this).find("a").stop().animate({color : colorMain}, animSpeed)
        },
        function() {
            $(this).stop().animate({backgroundColor : colorMain}, animSpeed);
            $(this).find("a").stop().animate({color : colorBlank}, animSpeed)
        });
$(".socialIcon")
    .hover(
        function() {
            $(this).stop().animate({backgroundColor : colorBlank}, animSpeed);
            $(this).find(".socialIconGray").stop().css({opacity : 0}).animate({
                opacity : 1
            })
        },
        function() {
            $(this).stop().animate({backgroundColor : colorMain}, animSpeed);
            $(this).find(".socialIconGray").stop().css({opacity : 1}).animate({
                opacity : 0
            })
        });
$(".truncate").click(function()
{
    $(this).toggleClass("truncate");
});
