function searchYouTube() {

    let query =
        document.getElementById("youtubeSearch").value;

    if (query.trim() === "") {

        alert("Please type something!");

        return;
    }

    let url =
        "https://www.youtube.com/results?search_query="
        + encodeURIComponent(query);

    window.open(url, "_blank");
}

function suggestFood() {

    let foods = [
        "Pizza 🍕",
        "Chocolate 🍫",
        "Ice Cream 🍦",
        "Burger 🍔",
        "Fries 🍟",
        "Pasta 🍝"
    ];

    let randomFood =
        foods[Math.floor(Math.random() * foods.length)];

    document.getElementById("foodResult").innerText =
        "You should try: " + randomFood;
}

function recommendFood() {

    let mood =
        document.getElementById("mood").value;

    let result = "";

    if (mood === "sad") {

        result = "Chocolate Lava Cake 🍫";
    }

    else if (mood === "happy") {

        result = "Pizza Party 🍕";
    }

    else {

        result = "Healthy Smoothie 🥤";
    }

    document.getElementById("recommendation").innerText =
        result;
}

function getAdvice() {

    let text =
        document.getElementById("problem")
        .value
        .toLowerCase();

    let response = "";

    if (text.includes("pain")
        || text.includes("cramp")) {

        response =
            "Use a heating pad, drink warm water, and take proper rest.";
    }

    else if (text.includes("mood")) {

        response =
            "Mood swings are common. Try calming music and relaxation.";
    }

    else {

        response =
            "Please consult a professional doctor.";
    }

    document.getElementById("advice").innerText =
        response;
}

function sendMessage() {

    let input =
        document.getElementById("chatInput");

    if (input.value.trim() === "")
        return;

    let chatBox =
        document.getElementById("chatBox");

    let msg =
        document.createElement("p");

    msg.innerText =
        input.value;

    chatBox.appendChild(msg);

    input.value = "";
}