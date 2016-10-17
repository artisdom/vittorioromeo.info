


In my previous article, [*"visiting variants using lambdas - part 1"*](https://vittorioromeo.info/index/blog/variants_lambdas_part_1.html), I wrote about a simple technique *(using [`boost::hana`](http://www.boost.org/doc/libs/1_62_0/libs/hana/doc/html/index.html))* that allows variant visitation using lambdas.

The technique consisted in using [`boost::hana::overload`](http://www.boost.org/doc/libs/1_61_0/libs/hana/doc/html/group__group-functional.html#ga83e71bae315e299f9f5f9de77b012139) in order to create a valid visitor with a variadic amount of lambdas, without having to define a `class`/`struct`.

<p></p>

Here's an example:

```cpp
using vnum = vr::variant<int, float, double>;

auto vnp = make_visitor
(
    [](int x)    { cout << x << "i\n"; },
    [](float x)  { cout << x << "f\n"; },
    [](double x) { cout << x << "d\n"; }
);

// Prints "0i"
vnum v0{0};
vr::visit(vnp, v0);

// Prints "5f"
v0 = 5.f;
vr::visit(vnp, v0);

// Prints "33.51d"
v0 = 33.51;
vr::visit(vnp, v0);
```

*(You can find a similar example [on GitHub](https://github.com/SuperV1234/vittorioromeo.info/blob/master/extra/visiting_variants/2_lambda_visitation.cpp).)*



### "Recursive" variants

TODO: ?

A *"recursive" variant* is a variant which can **contain itself**, and can be used to **represent recursive structures** *(e.g. JSON objects)*.

All variants need to **have a fixed size** - in order to allow the definition of recursive variants, **indirection must be used**. Making use of dynamically-allocated memory is a trivial way of introducing a layer of indirection: `std::unique_ptr` or `std::vector` are examples of data structures that can be used to define recursive variants.

TODO: ?

Since variants have a fixed size, a trivial way of implementing such structures consists of using **indirection with dynamically-allocated memory**.

As an example, let's extend our previous `vnum` variant type to support vectors of other `vnum` instances.

The first problem is that the variant will have to refer to itself in its own type alias definition - one possible solution is **forward-declaring** a `vnum_wrapper` class *(which can be safely "stored" in `std::vector` since the approval of [N4510](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2015/n4510.html))*:

```cpp
namespace impl
{
    struct vnum_wrapper;

    using varr = std::vector<vnum_wrapper>;
    using vnum = vr::variant<int, float, double, varr>;

    struct vnum_wrapper
    {
        vnum _data;

        template <typename... Ts>
        vnum_wrapper(Ts&&... xs)
            : _data{std::forward<Ts>(xs)...}
        {
        }
    };
}

// Expose `vnum` and `varr` to the user
using vnum = impl::vnum;
using impl::varr;
```

Thanks to the indirection provided by `std::vector` and to the wrapper class, `vnum` can now be used recursively:

```cpp
vnum v0 = 0;
vnum v1 = 5.f;
vnum v2 = 33.51;
vnum v3 = varr{vnum{1}, vnum{2.0}, vnum{3.f}};
vnum v4 = varr{vnum{5}, varr{vnum{7}, vnum{8.0}, vnum{9.}}, vnum{4.f}};
```

*(Note that creating something similar to `vnum_wrapper` works well with both `boost::variant` and `std::variant`. There is a small caveat: it does not compile with `libc++` unless the constructor is constrained. See [the addendum section](#libcpp_constraint) for more information.)*

Let's take a look at various visitation techniques in the following sections.



### *"Traditional"* recursive visitation

As seen in the last article, this technique requires the definition of a separate `class`/`struct`. The implementation is straightforward:

```cpp
struct vnum_printer
{
    void operator()(int x)    { cout << x << "i\n"; }
    void operator()(float x)  { cout << x << "f\n"; }
    void operator()(double x) { cout << x << "d\n"; }

    void operator()(const varr& arr)
    {
        for(const auto& x : arr)
        {
            vr::visit_recursively(*this, x);
        }
    }
};
```

The `vr::visit_recursively` function is a simple wrapper for `vr::visit` that hides the `vnum_wrapper::_data` access:

```cpp
template <typename TVisitor, typename TVariant>
decltype(auto) visit_recursively(TVisitor&& visitor, TVariant&& variant)
{
    return vr::visit
    (
        std::forward<TVisitor>(visitor),
        std::forward<TVariant>(variant)._data
    );
}
```

All that's left is invoking `vr::visit`, and everything *just works™*:

```cpp
// Prints "0i".
vnum v0{0};
vr::visit(vnum_printer{}, v0);

// Prints "5f".
v0 = 5.f;
vr::visit(vnum_printer, v0);

// Prints "33.51d".
v0 = 33.51;
vr::visit(vnum_printer, v0);

// Prints "1i 2d 3f".
v0 = varr{vnum{1}, vnum{2.0}, vnum{3.f}};
vr::visit(vnp, v0);

// Prints "5i 7i 8d 9d 4f".
v0 = varr{vnum{5}, varr{vnum{7}, vnum{8.0}, vnum{9.}}, vnum{4.f}};
vr::visit(vnp, v0);
```

*(You can find a similar example [on GitHub](https://github.com/SuperV1234/vittorioromeo.info/blob/master/extra/visiting_recursive_variants/0_traditional.cpp).)*



### *"Lambda-based"* recursive visitation - take one

Applying the `boost::hana::overload` solution seen in [part one](https://vittorioromeo.info/index/blog/variants_lambdas_part_1.html) to recursive variants seems reasonable.

```cpp
auto my_visitor = boost::hana::overload
(
    [](int x)    { cout << x << "i\n"; },
    [](float x)  { cout << x << "f\n"; },
    [](double x) { cout << x << "d\n"; },

    [&](const varr& arr)
    {
        for(const auto& x : arr)
        {
            vr::visit_recursively(my_visitor, x);
        }
    }
);
```

Unfortunately, we are greeted with a *compiler error*:

> error: variable 'my_visitor' declared with 'auto' type cannot appear in its own initializer

*(You can find a similar example [on GitHub](https://github.com/SuperV1234/vittorioromeo.info/blob/master/extra/visiting_variants/5_lambda_visitation_notworking.cpp).)*

In short, the problem is that `my_visitor`'s type will be deduced from its own initialization... but `my_visitor` is also part of the initialization! If we could explicitly specify the lambda's type in place of `auto`, the above code snippet could compile. [More details can be found here.](http://stackoverflow.com/questions/7861506/recursive-call-in-lambda-c11)

One common solution that is used to implement recursive lambdas is using [`std::function`](http://en.cppreference.com/w/cpp/utility/functional/function), which allows `auto` to be replaced with an explicit type that does not need to be deduced. Unfortunately `std::function` **is not a zero-cost abstraction**, as it's a general-purpose polymorphic wrapper.



### *"Lambda-based"* recursive visitation - take two

Bringing [algebraic data types](https://en.wikipedia.org/wiki/Algebraic_data_type) from the functional programming world into C++ isn't enough - we're also going to adopt another powerful construct: the [**Y Combinator**](https://en.wikipedia.org/wiki/Fixed-point_combinator#Fixed_point_combinators_in_lambda_calculus).

Long story short, this *fixed-point combinator* allows recursion to be impemented in languages that do not support it natively. **This applies to C++ lambdas:** we can use the Y Combinator to implement recursion. *(A very good in-depth explanation of the combinator [is available here](http://mvanier.livejournal.com/2897.html).)*

Thankfully, a production-ready implementation of the Y Combinator is available as [`boost::hana::fix`](http://www.boost.org/doc/libs/1_61_0/libs/hana/doc/html/group__group-functional.html#ga1393f40da2e8da6e0c12fce953e56a6c). Here's an example of its usage:

```cpp
auto factorial = boost::hana::fix([](auto self, auto n) -> int
    {
        if(n == 0)
        {
            return 1;
        }

        return n * self(n - 1);
    });

assert(factorial(5) == 120);
```

Here are some important points you need to take note of:

* `factorial`'s type is deduced through `auto`. No additional indirection a-la `std::function` is introduced here.

* `boost::hana::fix` requires a function with the *desired arity plus one* as its argument, because **"the lambda is passed to itself"** on every recursive step as the `self` parameter.

* The recursive step is implemented by calling `self`, not `factorial`.

    * Note that `factorial` does not appear in the body of the lambda, thus avoiding the previously seen compiler error.

* `boost::hana::fix` requires a [*trailing return type*](http://en.cppreference.com/w/cpp/language/function).

* Calling `factorial` does not require any additional parameters.

*(If you are interested in learning how to implement your own Y Combinator, check out [this question](http://stackoverflow.com/questions/35608977/understanding-y-combinator-through-generic-lambdas) I asked on StackOverflow when trying to understand the construct and write my own version of it.)*

Now that we have a way of defining recursive lambdas, we can finally implement a recursive lambda-based visitor. In order to make it easy for the user to implement their own visitors, a `make_recursive_visitor` function will be provided, which can be used as follows:

```cpp
// The desired return type must be explicitly specified.
auto vnp = make_recursive_visitor<void>
(
    // Non-recursive cases.
    // The first argument is ignored.
    [](auto, int x)    { cout << x << "i\n"; },
    [](auto, float x)  { cout << x << "f\n"; },
    [](auto, double x) { cout << x << "d\n"; },

    // Recursive case.
    // The first argument allows recursive visitation.
    [](auto visit_self, const varr& arr)
    {
        for(const auto& x : arr)
        {
            visit_self(x);
        }
    }
);
```

Here's the commented implementation of `make_recursive_visitor`:


```cpp
template <typename TReturn, typename... TFs>
auto make_recursive_visitor(TFs&&... fs)
{
    // Create and return a Y Combinator that allows the visitor to call itself.
    // The trailing return type is required.
    return boost::hana::fix([&fs...](auto self, auto&& x) -> TReturn
        {
            // Immediately build and call an overload of all visitor "branches".
            // The created overload is called with:
            // * A function that takes a variant and visits it recursively as
            //   the first argument.
            // * The current value of the variant as the second argument.
            return boost::hana::overload(std::forward<TFs>(fs)...)(
                [&self](auto&& v)
                {
                    return vr::visit_recursively(self, v);
                },
                std::forward<decltype(x)>(x));
        });
}
```

*(Note that the return type could probably be deduced inside `make_recursive_visitor` by inspecting the return type of every passed lambda using `decltype`.)*

Now we can put everything together to finally **visit a recursive variant using lambdas!**

```cpp
auto vnp = make_recursive_visitor<void>
(
    [](auto, int x)    { cout << x << "i\n"; },
    [](auto, float x)  { cout << x << "f\n"; },
    [](auto, double x) { cout << x << "d\n"; },

    [](auto visit_self, const varr& arr)
    {
        for(const auto& x : arr)
        {
            visit_self(x);
        }
    }
);

// Prints "0i".
vnum v0{0};
vr::visit(vnp, v0);

// Prints "5f".
v0 = 5.f;
vr::visit(vnp, v0);

// Prints "33.51d".
v0 = 33.51;
vr::visit(vnp, v0);

// Prints "1i 2d 3f".
v0 = varr{vnum{1}, vnum{2.0}, vnum{3.f}};
vr::visit(vnp, v0);

// Prints "5i 7i 8d 9d 4f".
v0 = varr{vnum{5}, varr{vnum{7}, vnum{8.0}, vnum{9.}}, vnum{4.f}};
vr::visit(vnp, v0);
```

*(You can find a similar example [on GitHub](https://github.com/SuperV1234/vittorioromeo.info/blob/master/extra/visiting_recursive_variants/1_lambda.cpp).)*


You're probably now asking...

> Why go through all that trouble? Why not just use `std::function`?

As I mentioned earlier, `std::function` is not a *zero-cost abstraction*. To prove it, [I've written a simple factorial lambda test](https://github.com/SuperV1234/Experiments/blob/master/recursive_lambda_asm/x.cpp) that can be conditionally compiled to either use `std::function` or `boost::hana::fix`. The [results are available in the addendum section](#stdfunction_vs_ycombinator). In short:

* `g++ -O3` produces **4572** bytes of assembly for `std::function`. *(!)*

* `g++ -O3` produces **1583** bytes of assembly for `boost::hana::fix`.

* `clang++ -O3` produces **7146** bytes of assembly for `std::function`. *(!)*

* `clang++ -O3` produces **765** bytes of assembly for `boost::hana::fix`.



TODO: all auto, hana::fix

TODO: mention addendum benchmarks


### *"Lambda-based"* recursive visitation - take three

TODO: recurse(...)?

TODO: mention addendum so

[test addendum link](#stdfunction_vs_ycombinator)


### Addendum

#### Fixing `vnum_wrapper` in `libc++` {#libcpp_constraint}

#### `std::function` vs Y-combinator {#stdfunction_vs_ycombinator}


TODO: std::function vs hana::fix asm

TODO: libc++ fix, SO question






# TODO

* libc++ workaround (with SO link)
*
* simple solution (repeat 'auto' in every lambda)
* hard solution (recurse(...) ((((((((
(

* TODO: Check Arthur's solution for recursive variants