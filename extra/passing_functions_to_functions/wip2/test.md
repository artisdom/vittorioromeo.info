**Function pointer**

|               |  O0  |  O1  |  O2  |  O3  |  Ofast
|---------------|------|------|------|------|-------
|g++ 6.2.1      |  5   |  2   |  2   |  2   |  2
|clang++ 3.9.0  |  5   |  2   |  2   |  2   |  2





**Template parameter**

|               |  O0  |  O1  |  O2  |  O3  |  Ofast
|---------------|------|------|------|------|-------
|g++ 6.2.1      |  36  |  4   |  4   |  4   |  4
|clang++ 3.9.0  |  33  |  12  |  4   |  4   |  4





**`function_view`**

|               |  O0   |  O1  |  O2  |  O3  |  Ofast
|---------------|-------|------|------|------|-------
|g++ 6.2.1      |  173  |  18  |  7   |  7   |  7
|clang++ 3.9.0  |  141  |  64  |  6   |  6   |  6





**`std::function`**

|               |  O0   |  O1   |  O2  |  O3  |  Ofast
|---------------|-------|-------|------|------|-------
|g++ 6.2.1      |  372  |  43   |  35  |  35  |  35
|clang++ 3.9.0  |  280  |  141  |  32  |  32  |  32