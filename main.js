let stripe_key = "sk_test_51Ij1HlGdXF8f4xhPrIfgoKw4K9hRY8NFpDbV7M14k6Rxslkhas4WYXNvxga5aTo1X1SFSttmFY4dkZQrEgTr9zbN00LeRZcFkH"; //Secret Key here
let Stripe = require("stripe")(stripe_key);

const domain = 'http://localhost:4000';


/** Verifies that a given product has the requested quantity in stock. 
 *  @param {[string]} productID [The objectID of a product that needs to verified]
 *  @param {[int]}    units     [The quanity of the product requested]
 *  @returns {[boolean]}         
 */
Parse.Cloud.define("verifyProduct", async(request) => {
    const productId = request.params.productId;
    const units     = request.params.units;
    let isAvailable = false;

    const query = new Parse.Query("Products");

    query.equalTo(productId);
    try {
        const results = await query.find();
        isAvailable = (results[0].attributes.Quantity >= 0) ? true : false;
        return results[0];
    } catch (error) {
        console.log(`Error ${error}, could not find the product id: ${productId}`);
    }
    
    return isAvailable;
});

/** Creats a secure checkout session based of a user's cart and generates payment, and information forms. Supports Google Pay. Must 
 * use Stripe.js to redirect to secure checkout.
 *  @param {[any]} cart [A cart object from the local session, holds desired items, and total]
 *  @returns {[session]} checkoutSession [A session that can be generated into a checkout page to securely obtain payment information]         
 */
Parse.Cloud.define("createCheckoutSession", async (req) => {
  const userCart = req.params.cart;
  console.log(userCart);
  const session = await Stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Masks',
            images: [userCart.cartObj[0].img_url],
          },
          unit_amount: userCart.cartTotal * 100,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${domain}/success.html`,
    cancel_url: `${domain}/cancel.html`,
  });
  
  console.log(session);

  return session;
});


/** Adds an item to order class. Performs a final check to verify product integrity. 
 *  @param {[string]} productID [The objectID of a product that needs to verified]
 *  @param {[int]}    units     [The quanity of the product requested]
 *  @throws {[string]} error    [throws error if requested item has been deleted or out of stock]
 *  @returns {[int]}  response.status [returns 200 for success, 400 for error]       
 */
Parse.Cloud.define("purchaseItem", async (request) => {
    let item, order;
    let itemQuery = new Parse.Query('Products');    
    itemQuery.equalTo('objectId', request.params.productId);

    const result = await itemQuery.first(null,{useMasterKey: true});

    if(!result){
        throw new Error('Sorry, this item is no longer available.');
    } else if(result.get('Quantity') <= 0){
        throw new Error('Sorry, this item is out of stock.');
    } else {
        item = result;
        item.increment('Quantity', -1);
        const object = await item.save(null,{useMasterKey: true})
        const order = new Parse.Object("Orders");
        order.set('Name', request.params.name);
        order.set('Email', request.params.email);
        order.set('Address', request.params.address);
        order.set('Zip', request.params.zip);
        order.set('City_State', request.params.city_state);
        order.set('productID', item.get('objectId'));
        order.set('Fulfilled', true);
        order.set('Charged', false);
        order.set('stripePaymentId', charge.id);            
        order.set('Charged', true);
        await order.save(null,{useMasterKey:true});
    }
    return '200';
});