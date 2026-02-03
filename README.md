// Paste this in the console
(function() {
    let basePrice = 500; // starting rebirth price
    let rebirths = parseInt(prompt("Enter the number of rebirths:"));
    if (isNaN(rebirths) || rebirths < 0) {
        console.log("Invalid number!");
        return;
    }
    let price = basePrice;
    for (let i = 0; i < rebirths; i++) {
        price = Math.floor(price * 1.5);
    }
    console.log(`Price for rebirth #${rebirths}: $${price}`);
})();
this is to see what the cost will be on a specific rebirth
